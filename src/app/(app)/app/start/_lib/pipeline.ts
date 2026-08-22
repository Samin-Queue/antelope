import { analyze } from "./analyze";
import type { IntakeFile } from "./fetch";
import { intake, type Ctx, type IntakeInput } from "./intake";
import { mergeNeeds } from "./needs";
import { prefill } from "./prefill";
import { reconcileNeeds } from "./reconcile";
import { research } from "./research";
import { judge, summarize } from "./summarize";
import { APPLY_URL_KEY, type FileInfo, type Stage, type StartEvent } from "./types";

/**
 * 1~5 단계를 순서대로 돌린다.
 *
 * 단계 하나가 실패해도 가능한 한 다음으로 간다 — Michael 이 죽어도 research 가
 * 뽑은 항목으로 신청은 할 수 있다. 멈추는 건 둘뿐이다: 입력을 못 읽었거나(1),
 * 요약이 bad 로 판정됐거나(3).
 *
 * 진행은 전부 이벤트로 흘린다. 여러 에이전트가 차례로 일하는 게 보여야
 * 기다리는 동안 화면이 죽은 것처럼 안 보인다.
 */
type Emit = (event: StartEvent) => void;

export async function runStart(
  input: IntakeInput,
  emit: Emit,
  opts: { userId: string | null },
): Promise<void> {
  const ctx: Ctx = { log: (text) => emit({ type: "log", text }) };

  const stage = async <T>(id: Stage, task: () => Promise<T>): Promise<T | null> => {
    emit({ type: "stage", stage: id, status: "start" });
    try {
      const value = await task();
      emit({ type: "stage", stage: id, status: "done" });
      return value;
    } catch (error) {
      emit({
        type: "stage",
        stage: id,
        status: "error",
        detail: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };

  // 1 — 입력 정리
  const gathered = await stage("intake", () => intake(input, ctx));
  if (!gathered) {
    emit({ type: "error", error: "입력을 읽지 못했습니다." });
    return;
  }
  if (
    gathered.files.length === 0 &&
    gathered.pages.length === 0 &&
    !gathered.sourceText
  ) {
    // 왜 못 읽었는지까지 말한다. 「읽을 게 없다」만 띄우면 아무 일도 안 일어난
    // 것으로 보이고, 정작 원인(차단·타임아웃)은 접힌 로그 안에 숨는다.
    const why = gathered.failures
      .map((item) => `${item.url} — ${friendly(item.reason)}`)
      .join("\n");
    emit({
      type: "stage",
      stage: "intake",
      status: "error",
      detail: gathered.failures.length ? "링크를 가져오지 못함" : "읽을 내용 없음",
    });
    emit({
      type: "error",
      error: why
        ? `링크를 가져오지 못했습니다.\n${why}\n\n페이지를 저장해 파일로 올리거나, 공고 내용을 붙여넣어 주세요.`
        : "읽을 수 있는 파일·페이지·문장이 없습니다.",
    });
    return;
  }
  emit({ type: "files", files: fileInfos(gathered.files) });

  // 2 — 요약
  const summary = await stage("summarize", () => summarize(gathered, ctx));
  if (!summary) {
    emit({ type: "error", error: "요약에 실패했습니다." });
    return;
  }
  emit({ type: "summary", markdown: summary.markdown, via: summary.via });

  // 3 — 판정. bad 면 여기서 끝난다.
  const verdict = await stage("judge", () => judge(summary));
  if (!verdict) return;
  emit({ type: "verdict", verdict: verdict.verdict, reason: verdict.reason });
  if (verdict.verdict === "bad") {
    for (const id of ["research", "analyze", "prefill"] as const) {
      emit({ type: "stage", stage: id, status: "skip", detail: "요약이 bad 로 판정됨" });
    }
    return;
  }

  // 4 — 추가 조사
  const found = await stage("research", () => research(gathered, summary, ctx));
  const allFiles: IntakeFile[] = [...gathered.files, ...(found?.files ?? [])];
  if (found?.files.length) emit({ type: "files", files: fileInfos(allFiles) });

  // 5 — 정밀 분석 (1·3단계가 모은 파일 전부)
  const analysis = await stage("analyze", () => analyze(allFiles, summary, ctx));

  // 병합 — 신청 링크를 묻는 항목은 맨 앞, 그다음 Michael, 그다음 research.
  const researchNeeds = found?.needs ?? [];
  const applyNeed = researchNeeds.find((need) => need.key === APPLY_URL_KEY);
  const reconciled = await reconcileNeeds(
    analysis?.needs ?? [],
    researchNeeds.filter((need) => need.key !== APPLY_URL_KEY),
  );
  const merged = mergeNeeds(applyNeed ? [applyNeed] : [], reconciled);
  ctx.log(`입력 항목 ${merged.length}개로 병합`);

  // 6 — 선채움
  const filled =
    (await stage("prefill", () => prefill(merged, opts.userId, ctx))) ?? merged;

  const title =
    (found?.title && found.title !== "제목 미상" ? found.title : null) ??
    analysis?.title ??
    gathered.files[0]?.name ??
    gathered.pages[0]?.title ??
    "제목 미상";

  emit({
    type: "needs",
    title,
    organization: found?.organization ?? null,
    deadline: found?.deadline ?? null,
    applyUrl: found?.applyUrl ?? null,
    needs: filled,
  });
}

/**
 * fetch 가 던지는 말을 사람 말로 옮긴다.
 * `fetch failed` 는 사용자에게 아무 정보도 아니다 — 대개 그 사이트가 우리를
 * 막았거나(공공기관 사이트가 흔하다) 응답이 없는 것이다.
 */
function friendly(reason: string): string {
  if (/timeout|timed out|abort/i.test(reason)) return "응답이 없어 시간 초과됐습니다";
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|certificate|TLS|SSL/i.test(reason)) {
    return "접속이 막혔습니다 (사이트가 외부 접근을 차단했을 수 있습니다)";
  }
  if (/HTTP 4\d\d/.test(reason))
    return `${reason} — 접근 권한이 없거나 주소가 틀렸습니다`;
  if (/HTTP 5\d\d/.test(reason)) return `${reason} — 상대 서버 오류입니다`;
  if (/25MB/.test(reason)) return reason;
  return reason;
}

function fileInfos(files: IntakeFile[]): FileInfo[] {
  return files.map((file) => ({
    name: file.name,
    origin: file.origin,
    bytes: file.blob.size,
  }));
}
