import { analyze } from "./analyze";
import type { IntakeFile } from "./fetch";
import {
  artifactDir,
  fillTemplates,
  pdfCopy,
  planDocuments,
  recallArtifacts,
  writeDocument,
} from "./file-agent";
import { intake, type Ctx, type IntakeInput } from "./intake";
import { mergeNeeds } from "./needs";
import { makePlan } from "./plan";
import { prefill } from "./prefill";
import { reconcileNeeds } from "./reconcile";
import { research } from "./research";
import { createSession } from "./session";
import { judge, summarize } from "./summarize";
import {
  APPLY_URL_KEY,
  type Artifact,
  type FileInfo,
  type SessionSnapshot,
  type Stage,
  type StartEvent,
} from "./types";

/**
 * 1~5 단계를 순서대로 돌린다.
 *
 * 단계 하나가 실패해도 가능한 한 다음으로 간다 — 정보 분석 이 죽어도 research 가
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
  // 로그가 어느 카드의 것인지 말해야 카드마다 흘릴 수 있다. `stage()` 가
  // 실행 중인 단계를 여기에 남긴다.
  let current: Stage = "intake";
  const ctx: Ctx = { log: (text) => emit({ type: "log", stage: current, text }) };
  // 이번 실행이 만든 파일을 담을 곳. 세션 id 는 아직 없다(맨 끝에 만든다).
  const runId = crypto.randomUUID();
  emit({ type: "run", runId });

  // 세션에 그대로 실린다 — 다시 열었을 때 진행 레일을 같은 모양으로 그린다.
  const stages: SessionSnapshot["stages"] = {};
  const mark = (id: Stage, status: "done" | "error" | "skip", detail?: string) => {
    stages[id] = status;
    emit({ type: "stage", stage: id, status, detail });
  };

  const stage = async <T>(id: Stage, task: () => Promise<T>): Promise<T | null> => {
    current = id;
    emit({ type: "stage", stage: id, status: "start" });
    try {
      const value = await task();
      mark(id, "done");
      return value;
    } catch (error) {
      mark(id, "error", error instanceof Error ? error.message : String(error));
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
    mark(
      "intake",
      "error",
      gathered.failures.length ? "링크를 가져오지 못함" : "읽을 내용 없음",
    );
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
      mark(id, "skip", "요약이 bad 로 판정됨");
    }
    return;
  }

  // 4 — 추가 조사
  const found = await stage("research", () => research(gathered, summary, ctx));
  const allFiles: IntakeFile[] = [...gathered.files, ...(found?.files ?? [])];
  if (found?.files.length) emit({ type: "files", files: fileInfos(allFiles) });

  // 5 — 정밀 분석 (1·3단계가 모은 파일 전부)
  const analysis = await stage("analyze", () => analyze(allFiles, summary, ctx));
  if (analysis?.brief) emit({ type: "brief", markdown: analysis.brief });

  // 병합 — 신청 링크를 묻는 항목은 맨 앞, 그다음 정보 분석, 그다음 research.
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

  // 7 — 계획. 마스터 테이블이 확정된 뒤에 세운다 — 무엇을 사용자에게 물어야
  // 하는지가 계획의 일부이기 때문이다.
  const plan = await stage("plan", () =>
    makePlan(
      {
        title,
        organization: found?.organization ?? null,
        deadline: found?.deadline ?? null,
        applyUrl: found?.applyUrl ?? null,
        brief: analysis?.brief ?? null,
        summary: summary.markdown,
        needs: filled,
        today: new Date().toISOString().slice(0, 10),
      },
      ctx,
    ),
  );
  if (plan) emit({ type: "plan", plan });

  // 8 — 서류 작성. 발급 서류는 손대지 않는다 — 만들면 위조다.
  const artifacts = await stage("documents", async () => {
    const brief = analysis?.brief ?? summary.markdown;
    const { jobs, obtain } = await planDocuments(filled, brief, ctx);
    const dir = artifactDir(runId);

    // 발급 서류는 만들지 않는다 — 보관함에 있으면 꺼내 쓴다.
    const recalled = await recallArtifacts(obtain, opts.userId, dir, ctx);
    // 공고가 준 지정 서식이 있으면 새로 쓰지 말고 그것을 채운다.
    const filledIn = await fillTemplates(allFiles, filled, dir, ctx);
    const made: Artifact[] = [...recalled, ...filledIn];
    if (jobs.length === 0) return made;
    for (const job of jobs) {
      try {
        const { artifact, markdown } = await writeDocument(
          job,
          { title, organization: found?.organization ?? null, brief, needs: filled },
          dir,
          ctx,
        );
        made.push(artifact);
        // 신청 페이지가 어떤 형식을 받는지는 여기서 알 수 없다. PDF 를 한 벌 더 둔다.
        const copy = await pdfCopy(artifact, markdown, job.title, dir, ctx);
        if (copy) made.push(copy);
      } catch (error) {
        // 한 문서가 실패해도 나머지는 만든다.
        ctx.log(
          `${job.label} 작성 실패: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    return made;
  });
  if (artifacts?.length) emit({ type: "artifacts", artifacts });

  const snapshot: SessionSnapshot = {
    title,
    organization: found?.organization ?? null,
    deadline: found?.deadline ?? null,
    applyUrl: found?.applyUrl ?? null,
    summary: { markdown: summary.markdown, via: summary.via },
    brief: analysis?.brief ?? null,
    files: fileInfos(allFiles),
    needs: filled,
    plan,
    artifacts: artifacts ?? [],
    stages,
  };

  // 여기가 「세션이 시작됐다」의 자연스러운 지점이다 — 마스터 테이블이 처음
  // 완성되는 순간. 신청 버튼을 눌러야 남기면 준비만 하고 떠난 세션이 사라진다.
  if (opts.userId) {
    const id = await createSession(opts.userId, snapshot);
    if (id) {
      emit({ type: "session", id });
      ctx.log(`세션 저장: ${id}`);
    }
  }

  emit({
    type: "needs",
    title: snapshot.title,
    organization: snapshot.organization,
    deadline: snapshot.deadline,
    applyUrl: snapshot.applyUrl,
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
