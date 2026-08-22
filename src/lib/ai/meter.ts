import { AsyncLocalStorage } from "node:async_hooks";

import { record } from "./ledger";

/**
 * 계측 — 호출부를 한 줄도 안 고치고 붙는다.
 *
 * LLM 호출은 21곳이고 그 전부가 `chatModel()` 을 거친다. `createOpenAICompatible`
 * 은 `fetch` 를 통째로 갈아끼울 수 있으므로, 그 자리 하나에 훅을 물리면 모든
 * 왕복이 원장에 잡힌다. 각 호출부에 `onFinish` 를 다는 것보다 싸고, 새 호출을
 * 추가하는 사람이 계측을 잊을 방법이 없다.
 *
 * **어떤 경우에도 요청을 방해하지 않는다.** 훅이 던지면 계측이 아니라 제품이
 * 죽는다. 그래서 전부 try 안이고, 응답은 `clone()` 으로만 읽는다 — 원본 body 를
 * 읽으면 `/api/chat` 의 스트리밍이 그 자리에서 깨진다.
 */
type Scope = { task: string; runId: string | null };

const store = new AsyncLocalStorage<Scope>();

/** 이 안에서 일어난 모든 모델 호출이 같은 `task`·`runId` 로 기록된다 */
export function withTask<T>(scope: Scope, fn: () => Promise<T>): Promise<T> {
  return store.run(scope, fn);
}

/** 실행 하나를 감싼다. 안쪽에서 `withTask` 가 작업 이름만 덮어쓴다 */
export function withRun<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ task: "run", runId }, fn);
}

export function currentScope(): Scope {
  return store.getStore() ?? { task: "unknown", runId: null };
}

/** 응답에서 usage 를 캐낸다. 프로바이더마다 자리가 조금씩 다르다 */
function usageOf(body: unknown): {
  model: string | null;
  input: number | null;
  output: number | null;
  cached: number | null;
} {
  const json = body as
    | {
        model?: string;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          input_tokens?: number;
          output_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
        };
      }
    | undefined;
  const u = json?.usage;
  return {
    model: json?.model ?? null,
    input: u?.prompt_tokens ?? u?.input_tokens ?? null,
    output: u?.completion_tokens ?? u?.output_tokens ?? null,
    cached: u?.prompt_tokens_details?.cached_tokens ?? null,
  };
}

export const meteredFetch: typeof globalThis.fetch = async (input, init) => {
  const started = performance.now();
  const { task, runId } = currentScope();
  try {
    const response = await globalThis.fetch(input, init);
    const ms = performance.now() - started;

    // ⚠ 원본이 아니라 clone 을 읽는다. 스트리밍 응답의 body 는 한 번만 읽힌다.
    const content = response.headers.get("content-type") ?? "";
    if (content.includes("application/json")) {
      void response
        .clone()
        .json()
        .then((body: unknown) => {
          const { model, input: i, output: o, cached } = usageOf(body);
          record({
            task,
            runId,
            ms,
            status: response.status,
            model,
            input: i,
            output: o,
            cached,
            at: Date.now(),
          });
        })
        .catch(() => {
          record({
            task,
            runId,
            ms,
            status: response.status,
            model: null,
            input: null,
            output: null,
            cached: null,
            at: Date.now(),
          });
        });
    } else {
      // SSE 스트리밍. usage 는 마지막 청크에 오는데 그걸 읽으려면 파이프를
      // 가로채야 한다 — 그 위험을 계측이 질 이유가 없다. 지연만 남긴다.
      record({
        task,
        runId,
        ms,
        status: response.status,
        model: null,
        input: null,
        output: null,
        cached: null,
        at: Date.now(),
      });
    }
    return response;
  } catch (error) {
    // 상태 0 = 전송 자체가 실패했다. 원장에서 실패로 센다.
    record({
      task,
      runId,
      ms: performance.now() - started,
      status: 0,
      model: null,
      input: null,
      output: null,
      cached: null,
      at: Date.now(),
    });
    throw error;
  }
};
