import { existsSync } from "node:fs";

import { isAbort } from "@/lib/ai/gateway";
import { lanes } from "@/lib/ai/lanes";
import { table } from "@/lib/ai/ledger";
import { withTask } from "@/lib/ai/meter";
import { matchEvidence, type Evidence } from "@/lib/grounding";

import { analyze, analyzeBudgetMs } from "./analyze";
import type { IntakeFile } from "./fetch";
import {
  artifactDir,
  fillTemplates,
  pdfCopy,
  planDocuments,
  recallArtifacts,
  writeDocument,
} from "./file-agent";
import { harvestSummary } from "./harvest";
import { intake, type Ctx, type Intake, type IntakeInput } from "./intake";
import { narrate, type NarrationTurn } from "./narrator";
import { mergeNeeds } from "./needs";
import { makePlan } from "./plan";
import { prefill } from "./prefill";
import { reconcileNeeds } from "./reconcile";
import { research } from "./research";
import { openRun, takeSteer } from "./run-registry";
import { createSession, updateSession } from "./session";
import { judge, summarize, type Summary } from "./summarize";
import {
  APPLY_URL_KEY,
  STAGE_LABEL,
  type Artifact,
  type CardKey,
  type FileInfo,
  type Need,
  type Plan,
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

/**
 * 한 번 더 해 볼 단계.
 *
 * 싼 것만 고른다. 실측(로컬, 데모 공고): research 15초 · analyze 36초 ·
 * plan 31초. `documents` 는 혼자 45~120초라 재시도가 준비 시간을 통째로 배로
 * 만들고, `summarize` 는 Studio job 이라 같은 이유로 뺐다. `intake`·`judge`·
 * `prefill` 은 실패해도 뒤 단계가 알아서 견딘다 — 재시도할 값어치가 없다.
 *
 * 전송 실패(429·5xx)는 이미 AI SDK 가 2회 재시도하고, 계약 위반은 게이트웨이가
 * 한 번 되묻는다. 여기는 그 둘로도 안 됐을 때의 마지막 한 번이다.
 */
export const RETRY_ONCE: ReadonlySet<Stage> = new Set(["research", "analyze", "plan"]);
/** 두 번째 시도의 상한. 첫 번째와 같이 주면 최악 준비 시간이 배가 된다 */
export const RETRY_LIMIT_MS = 90_000;
/** 상류가 흔들린 직후에 바로 다시 치면 같은 것을 맞는다 */
const RETRY_WAIT_MS = 1_500;

/** 이 단계를 몇 번까지 해 보는가 */
export function attemptsFor(id: Stage): number {
  return RETRY_ONCE.has(id) ? 2 : 1;
}

/**
 * 지금 실패한 것을 다시 해 볼 것인가.
 *
 * **시간이 모자라서 실패한 것은 다시 하지 않는다.** 같은 방식으로 또 기다리면
 * 그만큼 더 늦어질 뿐이고, 오래 걸리던 것이 두 번째에 갑자기 빨라질 이유가
 * 없다. 다시 해 볼 값어치가 있는 것은 상류가 한 번 흔들린 경우다.
 */
export function shouldRetry(id: Stage, attempt: number, timedOut: boolean): boolean {
  if (timedOut) return false;
  return attempt + 1 < attemptsFor(id);
}

/** 이번 시도에 줄 시간. 두 번째는 짧다 */
export function budgetFor(attempt: number, limitMs: number): number {
  return attempt === 0 ? limitMs : Math.min(limitMs, RETRY_LIMIT_MS);
}

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
  opts: {
    userId: string | null;
    /**
     * 죽은 실행을 **이어서** 돈다.
     *
     * 프로세스가 죽거나 단계가 통째로 실패해도 세션 행에는 거기까지가 남아
     * 있다(요약 직후부터 단계마다 덮어쓴다). 그 스냅샷을 넣으면 끝난 단계는
     * 건너뛰고 안 끝난 것부터 다시 돈다.
     *
     * ⚠ 원본 파일의 **바이트는 안 남는다**(스냅샷은 목록만 담는다). 그래서
     * 요약을 다시 만들 수는 없다 — 요약이 없는 스냅샷은 재개 대상이 아니고,
     * 처음부터 다시 올려야 한다. 그 대신 요약 이후는 전부 이어진다.
     */
    resume?: { id: string; snapshot: SessionSnapshot };
  },
): Promise<void> {
  // 로그가 어느 카드의 것인지 말해야 카드마다 흘릴 수 있다. `stage()` 가
  // 실행 중인 단계를 여기에 남긴다.
  let current: Stage = "intake";
  /**
   * 지금 도는 단계의 신호.
   *
   * `withTimeout` 은 `Promise.race` 라 시간이 지나도 **진 쪽이 계속 돈다** —
   * 상한은 있고 회수는 없었다. `stage()` 가 「사용자 취소 + 단계 상한」을
   * 합성해 여기 꽂아 두면, 상한을 넘긴 호출도 실제로 끊긴다.
   */
  let scoped: AbortSignal | undefined;
  const ctx: Ctx = {
    log: (text) => emit({ type: "log", stage: current, text }),
    get signal() {
      return scoped;
    },
  };
  /**
   * 단계 이름을 고정한 ctx.
   *
   * 두 단계가 **동시에** 돌면 `current` 하나로는 로그가 섞인다 — 계획이 쓴
   * 줄이 서류 카드에 뜨는 식이다. 병렬 구간에서는 이걸 쓴다.
   */
  const ctxOf = (id: Stage): Ctx => ({
    log: (text) => emit({ type: "log", stage: id, text }),
    // 병렬 구간은 자기 단계의 상한을 그대로 쓴다. `scoped` 는 그 시점의 것이다.
    signal: scoped,
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
  /**
   * 준비 중에도 사람이 끼어들 수 있게 레지스트리를 **여기서** 연다.
   *
   * 예전에는 신청(`/apply`)만 `openRun` 했다. 그래서 준비가 도는 몇 분 동안
   * 지시 상자가 죽어 있었고, 사용자가 할 수 있는 것은 다 끝난 뒤 결과를 통째로
   * 버리는 것뿐이었다. 닫는 것은 `run/route.ts` 의 `finally` 가 한다.
   */
  openRun(runId, opts.userId);
  /** 사용자가 준비 도중 한 말. 큐에서 꺼낸 것을 계속 들고 간다 */
  const directives: string[] = [];
  /**
   * 쌓인 지시를 꺼내 온다. 단계 경계에서만 부른다 — 단계 중간을 끊으면
   * 반쯤 만든 산출물이 남는다.
   *
   * 꺼낸 것은 **버리지 않고 누적한다.** 「주소는 본사로」는 계획에서 한 번
   * 쓰이고 마는 말이 아니라 그 뒤 단계에도 계속 유효하다.
   */
  const steered = (): string[] => {
    const fresh = takeSteer(runId);
    if (fresh.length === 0) return directives;
    directives.push(...fresh);
    for (const text of fresh) ctx.log(`사용자 지시: ${text}`);
    // 어디로 갔는지 화면에도 남긴다. 조용히 반영하면 전달됐는지 알 수 없다.
    emit({
      type: "card",
      card: "plan",
      headline: `지시 반영: ${text0(fresh)}`,
      body: "",
    });
    return directives;
  };

  /**
   * 서술 — 사실은 코드가 뽑아 넘긴다. 서술자가 산출물을 추측하지 않게.
   *
   * **크리티컬 패스에 두지 않는다.** 이 호출의 결과는 다음 단계의 입력이
   * 아니라 화면 문구다(`narrate` 는 실패해도 `null` 만 돌려준다). 그런데
   * 여섯 번을 전부 `await` 하고 있어서, 사용자는 준비가 끝난 뒤에도 문장이
   * 다 써지기를 기다렸다.
   *
   * 동시성 1 큐로 순서만 지킨다 — 앞말을 알아야 이어지는 글이 나오므로
   * 병렬로 풀면 안 된다. 마지막에 한 번 비운다.
   */
  let narrating: Promise<void> = Promise.resolve();
  const tell = (card: CardKey, facts: string, reason?: string) => {
    narrating = narrating
      .then(async () => {
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
        /**
         * ⚠ **여기서 반드시 잡는다.** 이 프로미스는 아무도 기다리지 않는다 —
         * 거부된 채로 두면 Node 가 `unhandledRejection` 으로 **프로세스를 죽인다.**
         * 화면 문구 하나 때문에 준비 전체가 사라지는 것이고, 밖에서는 「서버가
         * 종료 이벤트 없이 연결을 닫았다」로만 보인다.
         */
      })
      .catch((error) => {
        ctx.log(`서술 실패: ${error instanceof Error ? error.message : error}`);
      });
  };

  /**
   * 코드가 아는 한 줄을 **먼저** 박는다.
   *
   * `tell` 은 직렬 큐에 쌓여 모델을 한 번 더 부르고, 끝단의 서술은 `drainNarration`
   * 상한에 잘린다 — 계획·서류가 늘 마지막 둘이라 그 두 칸만 비어 있었다.
   * 서술이 도착하면 같은 칸을 덮어쓰므로(클라이언트 `patch` 는 병합이다) 손해가
   * 없고, 안 와도 칸이 「…」로 남지 않는다.
   */
  const note = (card: CardKey, headline: string) => {
    emit({ type: "card", card, headline, body: "" });
  };

  /**
   * 남은 서술을 비운다. 스트림을 닫기 전에 한 번.
   *
   * 상한을 둔다 — 서술 하나가 매달려 **준비 완료를 못 알리는** 것이 화면에
   * 문장 하나 빠지는 것보다 훨씬 나쁘다.
   */
  const drainNarration = async (limitMs = 8_000) => {
    await Promise.race([
      narrating.catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, limitMs)),
    ]);
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

  const restored = opts.resume?.snapshot ?? null;
  /** 이전 실행에서 이미 끝난 단계인가 */
  const already = (id: Stage) => restored?.stages[id] === "done";
  /**
   * 서류는 끝났다고 **다시 쓸 수 있는 게 아니다.**
   *
   * 산출물 경로는 컨테이너 임시 폴더라 재시작하면 사라진다. 스냅샷에 목록이
   * 남아 있어도 실제 파일이 없으면 브라우저가 업로드할 것이 없다 — 그때는
   * 아까워도 다시 만든다. 「있다고 말하고 없는 것」이 훨씬 나쁘다.
   */
  const alreadyUsable = (id: Stage) => {
    if (!already(id)) return false;
    if (id !== "documents") return true;
    const made = restored?.artifacts ?? [];
    return made.length > 0 && made.every((item) => existsSync(item.path));
  };

  /** 건너뛴다고 화면에 말한다. 조용히 넘기면 「안 했다」로 보인다 */
  const reuse = (id: Stage) => {
    stages[id] = "done";
    emit({ type: "stage", stage: id, status: "done", detail: "이전 실행에서 끝났다" });
  };

  const stage = async <T>(
    id: Stage,
    task: () => Promise<T>,
    limitMs = STAGE_TIMEOUT_MS,
  ): Promise<T | null> => {
    current = id;
    emit({ type: "stage", stage: id, status: "start" });
    const started = performance.now();
    const before = scoped;
    const attempts = attemptsFor(id);

    try {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const budget = budgetFor(attempt, limitMs);
        // 취소의 **유일한** 출처는 단계 상한이다. 사람이 떠난 것은 취소가 아니다 —
        // 준비는 끝까지 가서 세션 행에 쌓인다.
        scoped = AbortSignal.timeout(budget);
        try {
          // `withTask` 안의 모든 모델 왕복이 이 단계 이름으로 원장에 잡힌다.
          const value = await withTimeout(
            withTask({ task: id, runId }, task),
            budget,
            id,
          );
          mark(
            id,
            "done",
            attempt > 0 ? "한 번 다시 해서 됐다" : undefined,
            Math.round(performance.now() - started),
          );
          return value;
        } catch (error) {
          const timedOut = isAbort(error);
          const why = error instanceof Error ? error.message : String(error);
          if (shouldRetry(id, attempt, timedOut)) {
            ctx.log(`${STAGE_LABEL[id].title} 실패 — 한 번 다시 한다: ${why}`);
            emit({ type: "stage", stage: id, status: "start" });
            await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT_MS));
            continue;
          }
          // 상한에 걸렸으면 그 단계만 죽고 파이프라인은 계속 간다 —
          // 이 설계는 원래 한 단계 실패를 견디게 돼 있다.
          mark(
            id,
            "error",
            timedOut
              ? `${Math.round(budget / 1000)}초 안에 끝나지 않아 끊었다`
              : attempt > 0
                ? `두 번 시도했지만 실패: ${why}`
                : why,
            Math.round(performance.now() - started),
          );
          return null;
        }
      }
      return null;
    } finally {
      scoped = before;
    }
  };

  /**
   * 재개는 **요약이 있는 스냅샷**만 받는다.
   *
   * 원본 파일의 바이트는 안 남으므로 요약을 다시 만들 수 없다. 요약 전에 죽은
   * 실행은 처음부터 다시 올리는 것이 유일한 길이고, 그 사실을 그대로 말한다 —
   * 「이어서 준비」를 눌렀는데 조용히 빈 결과가 나오는 것이 최악이다.
   */
  if (restored && !restored.summary?.markdown?.trim()) {
    emit({
      type: "end",
      reason: "stopped",
      detail:
        "요약 전에 멈춘 실행이라 이어받을 수 없습니다. 파일이나 링크를 다시 넣어 주세요.",
    });
    return;
  }

  // 1 — 입력 정리. 재개면 원본이 없다 — 이후 단계는 요약으로 돈다.
  const gathered: Intake = restored
    ? { intent: "", files: [], pages: [], links: [], sourceText: null, failures: [] }
    : ((await stage("intake", () => intake(input, ctx))) as Intake);
  if (restored) reuse("intake");
  if (!gathered) {
    emit({ type: "error", error: "입력을 읽지 못했습니다." });
    return;
  }
  // 재개는 원본이 없는 게 정상이다. 「읽을 게 없다」로 막으면 안 된다.
  if (
    !restored &&
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
  emit({ type: "files", files: fileInfos(restored ? [] : gathered.files) });
  tell(
    "goal",
    restored
      ? [
          `지난 준비를 이어받는다: ${restored.title}`,
          `이미 끝난 단계: ${Object.entries(restored.stages)
            .filter(([, state]) => state === "done")
            .map(([id]) => id)
            .join(", ")}`,
          `입력 항목 ${restored.needs.length}개는 그대로 쓴다`,
        ].join("\n")
      : [
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

  // 2 — 요약. 재개면 스냅샷에 있는 것을 그대로 쓴다.
  const summary: Summary | null = restored
    ? { markdown: restored.summary!.markdown, via: restored.summary!.via, parts: [] }
    : // 파일마다 Studio job 이 하나씩 돈다. 1단계 예산(`INTAKE_BUDGET`)이
      // 6개라 레인 3개로 두 번에 나눠 도는데, 240초는 그 두 번을 못 담는다 —
      // 요약은 재시도 목록에 없어서 여기서 끊기면 실행이 통째로 끝난다.
      await stage("summarize", () => summarize(gathered, ctx), 420_000);
  if (restored) reuse("summarize");
  if (!summary) {
    emit({ type: "error", error: "요약에 실패했습니다." });
    return;
  }
  emit({ type: "summary", markdown: summary.markdown, via: summary.via });

  /**
   * 세션을 **여기서** 만든다.
   *
   * 예전에는 맨 끝에서 한 번 만들었다. 사용자가 탭을 닫아도 준비는 끝까지
   * 가지만(그게 의도다), 그 사이에 실패하거나 서버가 재시작되면 아무것도 안
   * 남는다 — 「긴 걸 시켜 놓고 나갔는데 흔적이 없다」가 된다.
   *
   * 요약이 끝난 시점이 제목이 처음 생기는 자리다. 이후 단계마다 덮어쓰므로
   * 지난 목표 목록에서 진행이 그대로 보인다.
   */
  /**
   * 진행 중인 상태. 단계가 채워 나가고 `snapshotNow()` 가 그때그때 찍는다.
   * `const` 로 두면 스냅샷을 맨 끝에서만 만들 수 있다.
   */
  let found: Awaited<ReturnType<typeof research>> | null = null;
  let analysis: Awaited<ReturnType<typeof analyze>> | null = null;
  let allFiles: IntakeFile[] = gathered.files;
  let filled: Need[] = [];
  let plan: Plan | null = null;
  let artifacts: Artifact[] = [];
  let evidence: Evidence[] = [];
  let title =
    gathered.files[0]?.name ?? gathered.pages[0]?.title ?? gathered.intent ?? "제목 미상";

  let sessionId: string | null = opts.resume?.id ?? null;
  const snapshotNow = (): SessionSnapshot => ({
    title,
    organization: found?.organization ?? null,
    deadline: found?.deadline ?? null,
    applyUrl: found?.applyUrl ?? null,
    summary: { markdown: summary.markdown, via: summary.via },
    brief: analysis?.brief ?? null,
    files: fileInfos(allFiles),
    needs: filled,
    plan,
    artifacts,
    stages,
    evidence,
    // 카드 문장과 폴더 id 를 함께 남긴다 — 지난 세션을 라이브와 같은 화면으로
    // 다시 그리려면 둘 다 필요하다.
    narration: [...history],
    runId,
  });

  /** 지금까지의 진행을 DB 에 덮어쓴다. 실패해도 파이프라인은 계속 간다 */
  const checkpoint = async () => {
    if (!opts.userId) return;
    try {
      if (!sessionId) {
        sessionId = await createSession(opts.userId, snapshotNow());
        if (sessionId) {
          emit({ type: "session", id: sessionId });
          ctx.log(`세션 저장: ${sessionId} — 탭을 닫아도 여기서 이어진다`);
        }
        return;
      }
      await updateSession(opts.userId, sessionId, snapshotNow());
    } catch (error) {
      ctx.log(`세션 저장 실패: ${error instanceof Error ? error.message : error}`);
    }
  };
  await checkpoint();

  // 3 — 판정. bad 면 여기서 끝난다. 재개면 이미 통과한 판정이다.
  const verdict = already("judge")
    ? ({ verdict: "good", reason: "이전 실행에서 판정됨" } as const)
    : await stage("judge", () => judge(summary, ctx.signal));
  if (already("judge")) reuse("judge");
  if (!verdict) {
    // 예전엔 여기서 아무 말 없이 스트림이 닫혔다. 화면에는 「연결이 끊겨
    // 중단됐다」만 뜨고, 서버가 스스로 끝낸 것인지 연결이 죽은 것인지
    // 구분할 수 없었다. 끝낼 때는 왜 끝내는지 말한다.
    await drainNarration();
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
    await drainNarration();
    emit({
      type: "end",
      reason: "stopped",
      detail: `공고로 읽을 내용이 부족합니다 — ${verdict.reason}`,
    });
    return;
  }

  // 4 — 추가 조사. 재개면 제목·주관·마감·신청 URL 이 이미 스냅샷에 있다.
  if (already("research") && restored) {
    reuse("research");
    found = {
      files: [],
      pages: [],
      applyUrl: restored.applyUrl,
      applyPage: null,
      needs: [],
      title: restored.title,
      organization: restored.organization,
      deadline: restored.deadline,
    };
  } else {
    // 2홉을 판다 — 상세 페이지 여덟 개를 열고 그 안의 첨부까지 받는다.
    // 240초는 1홉 시절의 값이라 여기서 먼저 끊기면 수집이 반만 된 채 넘어간다.
    found = await stage("research", () => research(gathered, summary, ctx), 360_000);
  }
  allFiles = [...gathered.files, ...(found?.files ?? [])];
  if (found?.files.length) emit({ type: "files", files: fileInfos(allFiles) });
  tell(
    "gather",
    [
      `제목: ${found?.title ?? "확인 안 됨"}`,
      `주관: ${found?.organization ?? "확인 안 됨"} · 마감: ${found?.deadline ?? "확인 안 됨"}`,
      `신청 URL: ${found?.applyUrl ?? "못 찾음 — 사람에게 물어야 한다"}`,
      `새로 받은 자료 ${found?.files.length ?? 0}개: ${(found?.files ?? []).map((f) => f.name).join(", ") || "없음"}`,
      // 「몇 개를 얼마나」가 증거다. 사람이 파일을 하나도 안 넣은 실행에서
      // 이 줄이 곧 「에이전트가 스스로 찾아냈다」의 근거가 된다.
      `Studio 에 넣을 자료 합계: ${harvestSummary(allFiles)}`,
      `추가로 연 상세 페이지 ${found?.pages.length ?? 0}개`,
      `신청 페이지에서 뽑은 입력 항목 ${found?.needs.length ?? 0}개`,
    ].join("\n"),
  );

  // 5 — 정밀 분석 (1·3단계가 모은 파일 전부). 재개면 준비 문서와 근거를 되살린다.
  if (already("analyze") && restored) {
    reuse("analyze");
    analysis = {
      needs: [],
      applicationType: null,
      title: restored.title,
      brief: restored.brief,
      via: "analysis",
      evidence: restored.evidence ?? [],
      // 재개는 스냅샷에서 되살린다. 검사 결과는 안 남기므로 없는 것으로 둔다 —
      // 통과한 척 보이게 하지 않는다.
      verdict: null,
    };
  } else {
    /**
     * 2홉에서 연 상세 페이지 본문도 넘긴다.
     *
     * 요약(2단계)은 이 페이지들을 보기 **전에** 끝났다. 첨부가 하나도 없는
     * 공고는 그 본문이 유일한 내용인데, 안 넘기면 Studio 에 태울 것이 없어
     * 「읽을 파일이 없다」로 떨어진다 — 정작 방금 읽어 온 것이 있는데도.
     */
    const extra = (found?.pages ?? [])
      .map((page) => `## ${page.title || page.url}\n\n${page.text}`)
      .join("\n\n");
    const bytes = allFiles.reduce((sum, file) => sum + file.blob.size, 0);
    analysis = await stage(
      "analyze",
      () => analyze(allFiles, summary, ctx, extra),
      // Studio 상한(analyze.ts)과 **같은 식**으로 잰다. 여기가 더 짧으면 Studio 가
      // 준 이유 대신 「시간 초과」만 남아 원인을 알 수 없다.
      analyzeBudgetMs(bytes),
    );
  }
  if (analysis) emit({ type: "via", stage: "analyze", via: analysis.via });
  if (analysis?.brief) emit({ type: "brief", markdown: analysis.brief });
  tell(
    "analyze",
    [
      `요약 경로: ${summary.via}`,
      `분석 경로: ${analysis?.via ?? "실패"} · 뽑아낸 입력 항목 ${analysis?.needs.length ?? 0}개`,
      analysis?.applicationType ? `신청 유형: ${analysis.applicationType}` : "",
      // Studio 가 규칙으로 센 결과. 「모델이 잘했다고 한다」와 구분해서 말한다.
      analysis?.verdict
        ? `Studio 검사 ${analysis.verdict.verdict}: ${analysis.verdict.checks.filter((check) => check.passed).length}/${analysis.verdict.checks.length} 통과` +
          (analysis.verdict.verdict === "green"
            ? ""
            : ` — 실패: ${analysis.verdict.checks
                .filter((check) => !check.passed)
                .map((check) => check.name)
                .join(", ")}`)
        : "",
      // 준비 문서 본문은 넘기지 않는다. 서술 한 줄을 만들자고 2,500자를 다시
      // 보내고 있었다 — 서술자가 알아야 하는 것은 내용이 아니라 규모다.
      `준비 문서 ${(analysis?.brief ?? summary.markdown).length.toLocaleString()}자`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  /**
   * 재개면 **병합·선채움을 다시 하지 않는다.**
   *
   * 마스터 테이블은 스냅샷에 통째로 있고, 사용자가 이미 채운 값도 거기 있다.
   * 다시 돌리면 모델 호출 두 번을 더 쓰면서 **사용자가 채운 값을 지운다** —
   * 그게 재개의 목적과 정반대다.
   */
  if (restored && restored.needs.length > 0) {
    reuse("prefill");
    filled = restored.needs;
    evidence = restored.evidence ?? [];
    title = restored.title;
    ctx.log(`이전 실행의 입력 항목 ${filled.length}개를 그대로 이어받는다`);
  } else {
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

    /**
     * 항목마다 원문 근거를 붙인다.
     *
     * 「왜 이걸 묻나」에 문장이 아니라 **좌표**로 답할 수 있게 된다. 못 찾은
     * 항목은 비워 둔다 — 그 사실이 화면에 그대로 보여야 한다.
     */
    evidence = analysis?.evidence ?? [];
    const withEvidence = evidence.length
      ? merged.map((need) => {
          const hits = matchEvidence(evidence, need.why ?? need.label);
          return hits.length
            ? { ...need, evidenceIds: hits.map((hit) => hit.evidence.id) }
            : need;
        })
      : merged;
    if (evidence.length) {
      const found = withEvidence.filter((need) => need.evidenceIds?.length).length;
      ctx.log(`원문 근거를 ${found}/${withEvidence.length}개 항목에 붙였다`);
    }

    // 6 — 선채움
    filled =
      (await stage("prefill", () => prefill(withEvidence, opts.userId, ctx))) ??
      withEvidence;
    const known = filled.filter((need) => need.value?.trim());
    tell(
      "data",
      [
        `필요한 항목 ${filled.length}개 · 지식베이스로 채운 것 ${known.length}개`,
        // ⚠ **값을 넘기지 않는다.** 화면 문구 한 줄을 만드는 호출에 사업자등록
        // 번호·생년월일·연락처를 실을 이유가 없다. 필요한 것은 무엇이 채워졌는가다.
        known.length
          ? `채운 항목: ${known.map((need) => need.label).join(", ")}`
          : "채운 것이 없다 — 처음 신청이거나 로그인 전이다",
        `물어야 하는 항목: ${filled
          .filter((need) => !need.value?.trim())
          .map((need) => need.label)
          .join(", ")}`,
      ].join("\n"),
    );
  }

  if (!restored || restored.needs.length === 0)
    title =
      (found?.title && found.title !== "제목 미상" ? found.title : null) ??
      analysis?.title ??
      gathered.files[0]?.name ??
      gathered.pages[0]?.title ??
      "제목 미상";

  // 여기까지가 「마스터 테이블이 처음 완성되는 순간」이다. 서류를 만들기 전에
  // 한 번 남긴다 — 문서 작성이 제일 오래 걸리고, 그동안 사용자는 대개 떠난다.
  await checkpoint();

  /**
   * 7·8 — 계획과 서류를 **나란히** 세운다.
   *
   * 둘 다 마스터 테이블이 확정된 뒤에 시작하지만, 서로의 출력은 안 본다 —
   * `documents` 가 받는 것은 `{title, organization, brief, filled}` 뿐이고
   * 계획은 거기 없다. 직렬로 두면 짧은 쪽만큼이 그냥 사라진다.
   *
   * `stage()` 가 각자 자기 실패를 삼키므로 `Promise.all` 이 던질 일은 없다.
   */
  const planTask = already("plan")
    ? (reuse("plan"), Promise.resolve(restored!.plan))
    : stage("plan", () =>
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
            directives: steered(),
          },
          ctxOf("plan"),
        ),
      );
  /**
   * 8 — 서류 작성. 발급 서류는 손대지 않는다 — 만들면 위조다.
   *
   * ⚠ 재개해도 **파일은 다시 만든다.** 산출물 경로는 컨테이너의 임시 폴더라
   * 재시작하면 사라진다 — 스냅샷에 이름만 남아 있고 바이트는 없다. 여기가
   * 제일 오래 걸리는 단계이므로 아까운 자리지만, 없는 파일을 있다고 하는 것이
   * 훨씬 나쁘다.
   */
  const documentsTask = alreadyUsable("documents")
    ? (reuse("documents"), Promise.resolve(restored!.artifacts))
    : stage("documents", async () => {
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
                if (isAbort(error)) throw error;
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

  const [madePlan, madeArtifacts] = await Promise.all([planTask, documentsTask]);
  plan = madePlan;
  artifacts = madeArtifacts ?? [];

  if (plan) emit({ type: "plan", plan });
  note("plan", plan ? `계획 수립 완료 · ${plan.steps.length}단계` : "계획을 세우지 못함");
  tell(
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
  note(
    "file",
    artifacts?.length ? `서류 작성 완료 · ${artifacts.length}건` : "작성한 서류 없음",
  );
  tell(
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

  const snapshot = snapshotNow();
  await checkpoint();

  emit({
    type: "needs",
    title: snapshot.title,
    organization: snapshot.organization,
    deadline: snapshot.deadline,
    applyUrl: snapshot.applyUrl,
    needs: filled,
  });
  await drainNarration();
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

/** 여러 줄이 한 번에 들어오면 첫 줄만 화면에 낸다. 손잡이 한 줄에 다 안 들어간다 */
function text0(lines: string[]): string {
  const head = lines[0] ?? "";
  return lines.length > 1
    ? `${head.slice(0, 24)}… 외 ${lines.length - 1}건`
    : head.slice(0, 30);
}
