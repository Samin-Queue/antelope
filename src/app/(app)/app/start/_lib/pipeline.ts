import { lanes } from "@/lib/ai/lanes";
import { table } from "@/lib/ai/ledger";
import { withTask } from "@/lib/ai/meter";

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
import { narrate, type NarrationTurn } from "./narrator";
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
  type CardKey,
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

/**
 * 단계 하나가 매달릴 수 있는 최대 시간.
 *
 * Studio job 은 자기 상한(180초)이 있지만 Solar 직접 호출에는 없었다. 외부가
 * 응답을 안 주면 `await` 가 영원히 안 풀리고, SSE 는 열린 채라 화면의 카드가
 * 계속 돈다 — 「간헐적 무한로딩」의 정체다. 상한을 두면 그 단계만 실패하고
 * 파이프라인은 계속 간다. 이 설계는 원래 한 단계 실패를 견디게 돼 있다.
 *
 * Studio 상한보다 넉넉히 잡는다. 여기서 먼저 끊으면 Studio 가 준 이유 대신
 * 「시간 초과」만 남아 원인을 알 수 없다.
 */
const STAGE_TIMEOUT_MS = 240_000;

function withTimeout<T>(task: Promise<T>, limitMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const alarm = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(`${label} 이(가) ${Math.round(limitMs / 1000)}초 안에 끝나지 않았다`),
        ),
      limitMs,
    );
  });
  // 이긴 쪽이 누구든 타이머는 끈다. 안 끄면 요청이 끝나도 프로세스가 남는다.
  return Promise.race([task, alarm]).finally(() => clearTimeout(timer)) as Promise<T>;
}

export async function runStart(
  input: IntakeInput,
  emit: Emit,
  opts: { userId: string | null },
): Promise<void> {
  // 로그가 어느 카드의 것인지 말해야 카드마다 흘릴 수 있다. `stage()` 가
  // 실행 중인 단계를 여기에 남긴다.
  let current: Stage = "intake";
  const ctx: Ctx = { log: (text) => emit({ type: "log", stage: current, text }) };
  /**
   * 단계 이름을 고정한 ctx.
   *
   * 두 단계가 **동시에** 돌면 `current` 하나로는 로그가 섞인다 — 계획이 쓴
   * 줄이 서류 카드에 뜨는 식이다. 병렬 구간에서는 이걸 쓴다.
   */
  const ctxOf = (id: Stage): Ctx => ({
    log: (text) => emit({ type: "log", stage: id, text }),
  });

  /**
   * 서술자의 기억.
   *
   * 단계마다 따로 쓰면 매번 처음부터 설명하는 글이 된다 — 앞에서 무엇을
   * 말했는지 알아야 「자료 조사에서 못 찾은 신청 URL 을 계획에서 사람에게
   * 묻기로 했다」 같은 이어진 말이 나온다.
   */
  const history: NarrationTurn[] = [];

  // 이번 실행이 만든 파일을 담을 곳이자 원장의 귀속 키. 세션 id 는 맨 끝에 만든다.
  const runId = crypto.randomUUID();
  emit({ type: "run", runId });

  /** 사실은 코드가 뽑아 넘긴다. 서술자가 산출물을 추측하지 않게 */
  const tell = async (card: CardKey, facts: string, reason?: string) => {
    emit({ type: "orchestrator", status: "start" });
    try {
      const said = await withTask({ task: "narrate", runId }, () =>
        narrate({ card, facts, history, reason }, ctx),
      );
      if (!said) return;
      history.push({ card, ...said });
      emit({ type: "card", card, headline: said.headline, body: said.body });
    } finally {
      emit({ type: "orchestrator", status: "done" });
    }
  };
  // 세션에 그대로 실린다 — 다시 열었을 때 진행 레일을 같은 모양으로 그린다.
  const stages: SessionSnapshot["stages"] = {};
  const mark = (
    id: Stage,
    status: "done" | "error" | "skip",
    detail?: string,
    ms?: number,
  ) => {
    stages[id] = status;
    emit({ type: "stage", stage: id, status, detail, ms });
  };

  const stage = async <T>(
    id: Stage,
    task: () => Promise<T>,
    limitMs = STAGE_TIMEOUT_MS,
  ): Promise<T | null> => {
    current = id;
    emit({ type: "stage", stage: id, status: "start" });
    const started = performance.now();
    try {
      // `withTask` 안에서 일어난 모든 모델 왕복이 이 단계 이름으로 원장에 잡힌다.
      const value = await withTimeout(withTask({ task: id, runId }, task), limitMs, id);
      mark(id, "done", undefined, Math.round(performance.now() - started));
      return value;
    } catch (error) {
      mark(
        id,
        "error",
        error instanceof Error ? error.message : String(error),
        Math.round(performance.now() - started),
      );
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
  await tell(
    "goal",
    [
      `사용자가 하려는 일: ${gathered.intent || "(문장 없음)"}`,
      `받은 파일 ${gathered.files.length}개: ${gathered.files.map((f) => f.name).join(", ") || "없음"}`,
      `읽은 페이지 ${gathered.pages.length}개: ${gathered.pages.map((p) => p.title || p.url).join(", ") || "없음"}`,
      gathered.failures.length
        ? `가져오지 못한 링크 ${gathered.failures.length}개: ${gathered.failures.map((f) => `${f.url} (${f.reason})`).join(" / ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  // 2 — 요약
  const summary = await stage("summarize", () => summarize(gathered, ctx));
  if (!summary) {
    emit({ type: "error", error: "요약에 실패했습니다." });
    return;
  }
  emit({ type: "summary", markdown: summary.markdown, via: summary.via });

  // 3 — 판정. bad 면 여기서 끝난다.
  const verdict = await stage("judge", () => judge(summary));
  if (!verdict) {
    // 예전엔 여기서 아무 말 없이 스트림이 닫혔다. 화면에는 「연결이 끊겨
    // 중단됐다」만 뜨고, 서버가 스스로 끝낸 것인지 연결이 죽은 것인지
    // 구분할 수 없었다. 끝낼 때는 왜 끝내는지 말한다.
    emit({
      type: "end",
      reason: "stopped",
      detail: "읽을 만한 공고인지 판정하지 못했습니다.",
    });
    return;
  }
  emit({ type: "verdict", verdict: verdict.verdict, reason: verdict.reason });
  if (verdict.verdict === "bad") {
    for (const id of ["research", "analyze", "prefill"] as const) {
      mark(id, "skip", "요약이 bad 로 판정됨");
    }
    emit({
      type: "end",
      reason: "stopped",
      detail: `공고로 읽을 내용이 부족합니다 — ${verdict.reason}`,
    });
    return;
  }

  // 4 — 추가 조사
  const found = await stage("research", () => research(gathered, summary, ctx));
  const allFiles: IntakeFile[] = [...gathered.files, ...(found?.files ?? [])];
  if (found?.files.length) emit({ type: "files", files: fileInfos(allFiles) });
  await tell(
    "gather",
    [
      `제목: ${found?.title ?? "확인 안 됨"}`,
      `주관: ${found?.organization ?? "확인 안 됨"} · 마감: ${found?.deadline ?? "확인 안 됨"}`,
      `신청 URL: ${found?.applyUrl ?? "못 찾음 — 사람에게 물어야 한다"}`,
      `새로 받은 자료 ${found?.files.length ?? 0}개: ${(found?.files ?? []).map((f) => f.name).join(", ") || "없음"}`,
      `신청 페이지에서 뽑은 입력 항목 ${found?.needs.length ?? 0}개`,
    ].join("\n"),
  );

  // 5 — 정밀 분석 (1·3단계가 모은 파일 전부)
  const analysis = await stage("analyze", () => analyze(allFiles, summary, ctx));
  if (analysis) emit({ type: "via", stage: "analyze", via: analysis.via });
  if (analysis?.brief) emit({ type: "brief", markdown: analysis.brief });
  await tell(
    "analyze",
    [
      `요약 경로: ${summary.via}`,
      `분석 경로: ${analysis?.via ?? "실패"} · 뽑아낸 입력 항목 ${analysis?.needs.length ?? 0}개`,
      analysis?.applicationType ? `신청 유형: ${analysis.applicationType}` : "",
      "",
      "준비 문서(앞부분):",
      (analysis?.brief ?? summary.markdown).slice(0, 2_500),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  // 병합 — 신청 링크를 묻는 항목은 맨 앞, 그다음 정보 분석, 그다음 research.
  const researchNeeds = found?.needs ?? [];
  const applyNeed = researchNeeds.find((need) => need.key === APPLY_URL_KEY);
  // 단계 밖이라 `stage()` 의 보호를 못 받는다. 모델 호출이므로 여기도 상한을
  // 건다 — 매달리면 카드는 하나도 안 도는데 화면만 멈춰 더 헷갈린다.
  const reconciled = await withTimeout(
    withTask({ task: "reconcile", runId }, () =>
      reconcileNeeds(
        analysis?.needs ?? [],
        researchNeeds.filter((need) => need.key !== APPLY_URL_KEY),
      ),
    ),
    STAGE_TIMEOUT_MS,
    "항목 병합",
  ).catch((error) => {
    ctx.log(`항목 병합 실패: ${error instanceof Error ? error.message : error}`);
    return [...(analysis?.needs ?? []), ...researchNeeds];
  });
  const merged = mergeNeeds(applyNeed ? [applyNeed] : [], reconciled);
  ctx.log(`입력 항목 ${merged.length}개로 병합`);

  // 6 — 선채움
  const filled =
    (await stage("prefill", () => prefill(merged, opts.userId, ctx))) ?? merged;
  const known = filled.filter((need) => need.value?.trim());
  await tell(
    "data",
    [
      `필요한 항목 ${filled.length}개 · 지식베이스로 채운 것 ${known.length}개`,
      known.length
        ? `채운 항목: ${known.map((need) => `${need.label}=${need.value}`).join(", ")}`
        : "채운 것이 없다 — 처음 신청이거나 로그인 전이다",
      `물어야 하는 항목: ${filled
        .filter((need) => !need.value?.trim())
        .map((need) => need.label)
        .join(", ")}`,
    ].join("\n"),
  );

  const title =
    (found?.title && found.title !== "제목 미상" ? found.title : null) ??
    analysis?.title ??
    gathered.files[0]?.name ??
    gathered.pages[0]?.title ??
    "제목 미상";

  /**
   * 7·8 — 계획과 서류를 **나란히** 세운다.
   *
   * 둘 다 마스터 테이블이 확정된 뒤에 시작하지만, 서로의 출력은 안 본다 —
   * `documents` 가 받는 것은 `{title, organization, brief, filled}` 뿐이고
   * 계획은 거기 없다. 직렬로 두면 짧은 쪽만큼이 그냥 사라진다.
   *
   * `stage()` 가 각자 자기 실패를 삼키므로 `Promise.all` 이 던질 일은 없다.
   */
  const planTask = stage("plan", () =>
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
      ctxOf("plan"),
    ),
  );
  // 8 — 서류 작성. 발급 서류는 손대지 않는다 — 만들면 위조다.
  const documentsTask = stage("documents", async () => {
    const ctx = ctxOf("documents");
    const brief = analysis?.brief ?? summary.markdown;
    const dir = artifactDir(runId);

    /**
     * 셋을 나란히 돌린다.
     *
     * 예전엔 `planDocuments` 가 맨 앞에 있고 try 도 없어서, 분류 모델이 한 번
     * 흔들리면 그 뒤의 `fillTemplates` 까지 통째로 사라졌다 — 공고가 준 지정
     * 서식은 모델과 아무 상관이 없는데도. `recallArtifacts` 만 분류 결과
     * (`obtain`)에 의존하므로 그것만 뒤에 붙인다.
     */
    const [planned, filledIn] = await Promise.all([
      planDocuments(filled, brief, ctx).catch((error) => {
        ctx.log(
          `작성/발급 분류 실패 — 지정 서식과 보관함만 쓴다: ${error instanceof Error ? error.message : error}`,
        );
        return { jobs: [], obtain: [] as string[] };
      }),
      // 공고가 준 지정 서식이 있으면 새로 쓰지 말고 그것을 채운다.
      fillTemplates(allFiles, filled, dir, ctx).catch((error) => {
        ctx.log(
          `지정 서식 채우기 실패: ${error instanceof Error ? error.message : error}`,
        );
        return [] as Artifact[];
      }),
    ]);
    const { jobs, obtain } = planned;

    // 발급 서류는 만들지 않는다 — 보관함에 있으면 꺼내 쓴다.
    const recalled = await recallArtifacts(obtain, opts.userId, dir, ctx).catch(
      () => [] as Artifact[],
    );
    const made: Artifact[] = [...recalled, ...filledIn];
    if (jobs.length === 0) return made;
    // 문서끼리 서로를 참조하지 않는다. 직렬로 쓰면 편수만큼 곱해질 뿐이다.
    const written = await Promise.all(
      jobs.map((job) =>
        lanes.batch(async () => {
          try {
            const { artifact, markdown } = await writeDocument(
              job,
              {
                title,
                organization: found?.organization ?? null,
                brief,
                needs: filled,
                // 이게 없으면 서술형 기억(`memories.embedding`)이 한 번도 안 쓰인다.
                userId: opts.userId,
              },
              dir,
              ctx,
            );
            // 신청 페이지가 어떤 형식을 받는지는 여기서 알 수 없다. PDF 를 한 벌 더 둔다.
            const copy = await pdfCopy(artifact, markdown, job.title, dir, ctx);
            return copy ? [artifact, copy] : [artifact];
          } catch (error) {
            // 한 문서가 실패해도 나머지는 만든다.
            ctx.log(
              `${job.label} 작성 실패: ${error instanceof Error ? error.message : error}`,
            );
            return [] as Artifact[];
          }
        }),
      ),
    );
    made.push(...written.flat());
    return made;
  });

  const [plan, artifacts] = await Promise.all([planTask, documentsTask]);

  if (plan) emit({ type: "plan", plan });
  await tell(
    "plan",
    plan
      ? [
          `${plan.steps.length}단계로 세웠다.`,
          ...plan.steps.map(
            (step) =>
              `  ${step.title} — 담당 ${step.owner}${step.dueDate ? ` · ${step.dueDate}` : ""}`,
          ),
        ].join("\n")
      : "계획을 세우지 못했다.",
  );

  if (artifacts?.length) emit({ type: "artifacts", artifacts });
  await tell(
    "file",
    artifacts?.length
      ? artifacts
          .map(
            (item) =>
              `${item.filename} — ${item.label} (${item.from === "agent" ? "직접 작성" : item.from === "memory" ? "보관함에서 꺼냄" : "사용자가 올림"})`,
          )
          .join("\n")
      : "만든 서류가 없다. 발급받아야 하는 것뿐이거나 작성할 것이 없었다.",
  );

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
  emit({ type: "end", reason: "ready" });
  // 개발 중에는 런 하나의 단계별 토큰·지연을 그 자리에서 본다.
  table(runId);
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
