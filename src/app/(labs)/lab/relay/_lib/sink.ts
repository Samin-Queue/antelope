import {
  CARD_LABEL,
  STAGE_LABEL,
  STAGES,
  type AgentKey,
  type Need,
  type StartEvent,
} from "@/app/(app)/app/start/_lib/types";

import type { RelayChannel, ThreadRef } from "./channel";

/**
 * 준비 파이프라인의 이벤트를 스레드로 옮긴다.
 *
 * **그대로 보내면 도배가 된다.** `StartEvent` 는 16종이고 `pipeline.ts` 의
 * `emit` 호출 지점만 20곳이며 `log` 는 단계마다 여러 번 나온다. 그래서 둘로
 * 나눈다 — 흐르는 것은 **메시지 하나를 고쳐** 보여주고, 남을 것만 댓글이 된다.
 *
 * 남기는 것: 서술자 카드 · 착수 판정 · 만든 서류 · 물어야 할 항목 · 종료.
 * 버리는 것: `log`(표시줄의 마지막 줄로만) · `orchestrator` · `stage`(숫자로만)
 *            · `files` · `via` · `run` · `summary`(길다) · `brief`(길다).
 */

/** 표시줄을 고치는 간격. 슬랙 `chat.update` 한도 안쪽으로 여유 있게 */
const THROTTLE_MS = 3_000;

export type SinkResult = {
  /** `goals.id`. 「이어서 하기」 링크의 재료 */
  goalId: string | null;
  /**
   * 이번 실행이 파일을 담는 폴더 id.
   *
   * 사람이 스레드에 올린 서류를 **같은 자리**에 두어야 신청 단계가 그것을
   * 찾는다. 버리면 첨부가 갈 곳을 잃는다.
   */
  runId: string | null;
  needs: Need[] | null;
  applyUrl: string | null;
  title: string | null;
  /** 준비가 어떻게 끝났는가. `end` 를 못 받았으면 null — 그 자체가 사고 신호다 */
  ended: "ready" | "stopped" | null;
  detail: string | null;
  error: string | null;
};

export type Sink = {
  emit: (event: StartEvent) => void;
  /** 밀린 편집까지 흘려보내고 조용해질 때까지 기다린다. 실행 뒤 **반드시** 부른다 */
  flush: () => Promise<void>;
  result: () => SinkResult;
  /** 진행 표시줄로 쓰는 메시지 id. DB 에 남겨 재시작 뒤에도 이어 고칠 수 있게 */
  progressMessageId: () => string | null;
};

export function makeSink(channel: RelayChannel, ref: ThreadRef): Sink {
  const result: SinkResult = {
    goalId: null,
    runId: null,
    needs: null,
    applyUrl: null,
    title: null,
    ended: null,
    detail: null,
    error: null,
  };

  let progressId: string | null = null;
  let stage: string | null = null;
  let done = 0;
  let note = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastEditAt = 0;

  /**
   * 발신을 한 줄로 세운다.
   *
   * 슬랙 API 를 동시에 때리면 댓글 순서가 뒤바뀌고 한도에도 먼저 닿는다.
   * 실패가 사슬을 끊지 않게 `then` 의 양쪽에 같은 작업을 건다 — 브라우저
   * 에이전트에서 도구 호출을 직렬화한 것과 같은 이유다.
   */
  let chain: Promise<unknown> = Promise.resolve();
  const queue = <T>(task: () => Promise<T>): Promise<void> => {
    chain = chain.then(task, task).catch((error) => {
      console.error("[relay/sink] 발신 실패", error);
    });
    return chain as Promise<void>;
  };

  function progressText(): string {
    // `as never` 로 좁히면 `Record<K,V>[never]` 가 `never` 라 `.title` 이 없다.
    // 여기 담기는 것은 `AgentKey` 이므로 그걸로 좁힌다.
    const label = stage ? (STAGE_LABEL[stage as AgentKey]?.title ?? stage) : "시작";
    const bar = `${"■".repeat(done)}${"□".repeat(Math.max(0, STAGES.length - done))}`;
    const tail = note ? `\n${note.slice(0, 200)}` : "";
    return `${bar} ${done}/${STAGES.length} · ${label}${tail}`;
  }

  function writeProgress(): Promise<void> {
    lastEditAt = Date.now();
    const text = progressText();
    return queue(async () => {
      if (progressId) {
        await channel.edit(ref, progressId, text);
      } else {
        progressId = await channel.post(ref, text);
      }
    });
  }

  let started = false;

  /**
   * 표시줄 갱신을 모은다. 이미 예약돼 있으면 그 예약이 최신 값을 쓴다.
   *
   * **첫 줄만은 스로틀을 타지 않는다.** 기다리게 하면 표시줄이 실행이 끝날 때
   * 한 번 생기고 만다 — 사람은 그동안 아무 반응도 못 본다. 실측으로 잡았다:
   * 이 분기가 없으면 스레드에 카드 댓글이 표시줄보다 먼저 뜬다.
   */
  function bump() {
    if (!started) {
      started = true;
      void writeProgress();
      return;
    }
    if (timer) return;
    const wait = Math.max(0, THROTTLE_MS - (Date.now() - lastEditAt));
    timer = setTimeout(() => {
      timer = null;
      void writeProgress();
    }, wait);
  }

  const milestone = (text: string) => queue(() => channel.post(ref, text).then(() => {}));

  const emit = (event: StartEvent) => {
    switch (event.type) {
      case "stage":
        stage = event.stage;
        if (event.status === "done" || event.status === "skip") done += 1;
        bump();
        break;

      case "log":
        note = event.text;
        bump();
        break;

      case "card":
        void milestone(`*${CARD_LABEL[event.card]}* — ${event.headline}\n${event.body}`);
        break;

      case "verdict":
        // 나쁘면 여기서 런이 끝난다. 이유를 반드시 남긴다.
        if (event.verdict === "bad") {
          void milestone(`⛔ 착수하지 않는 편이 낫다고 판단했다.\n${event.reason}`);
        }
        break;

      case "artifacts":
        if (event.artifacts.length) {
          void milestone(
            `📎 서류 ${event.artifacts.length}건을 준비했다.\n` +
              event.artifacts.map((a) => `· ${a.filename} — ${a.label}`).join("\n"),
          );
        }
        break;

      case "needs":
        // 무엇을 물어야 하는지는 호스트가 정한다(Step 2). 여기서는 재료만 모은다.
        result.needs = event.needs;
        result.applyUrl = event.applyUrl;
        result.title = event.title;
        break;

      case "run":
        result.runId = event.runId;
        break;

      case "session":
        result.goalId = event.id;
        break;

      case "end":
        result.ended = event.reason;
        result.detail = event.detail ?? null;
        break;

      case "error":
        result.error = event.error;
        void milestone(`⚠️ ${event.error}`);
        break;

      default:
        // files · summary · brief · via · plan · orchestrator — 표시줄에도 안 싣는다.
        break;
    }
  };

  return {
    emit,
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await writeProgress();
      await chain;
    },
    result: () => ({ ...result }),
    progressMessageId: () => progressId,
  };
}
