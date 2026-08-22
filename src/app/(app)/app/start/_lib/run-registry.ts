/**
 * 실행 중인 신청을 id 로 찾는 자리.
 *
 * SSE 는 단방향이라 사용자가 도중에 무언가를 주려면 별도 요청이 와야 하고,
 * 그 요청이 **지금 돌고 있는 실행**을 찾아 꽂을 수 있어야 한다.
 * `desktop.ts` 의 세션 Map + `setHold`/`waitWhileHeld` 와 같은 패턴이다.
 *
 * 프로세스 메모리에 둔다. 인스턴스가 하나라 충분하고(Railway `numReplicas: 1`),
 * 실행이 끝나면 사라져야 하는 것이라 DB 에 넣을 이유가 없다.
 */
export type Pending = {
  id: string;
  label: string;
  resolve: (value: string | null) => void;
};

type Run = {
  /** 답을 기다리는 질문들 */
  pending: Map<string, Pending>;
  /** 사용자가 끼워 넣은 지시. 단계 경계에서 꺼낸다 */
  steer: string[];
  /** 즉시 중단 요청 */
  abort: AbortController;
  createdAt: number;
};

const runs = new Map<string, Run>();
const TTL_MS = 30 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [id, run] of runs) {
    if (now - run.createdAt > TTL_MS) {
      // 기다리던 질문은 끊어 준다 — 안 그러면 그 실행이 영원히 멈춰 있다.
      for (const item of run.pending.values()) item.resolve(null);
      runs.delete(id);
    }
  }
}

export function openRun(id: string): Run {
  sweep();
  const run: Run = {
    pending: new Map(),
    steer: [],
    abort: new AbortController(),
    createdAt: Date.now(),
  };
  runs.set(id, run);
  return run;
}

export function closeRun(id: string) {
  const run = runs.get(id);
  if (!run) return;
  for (const item of run.pending.values()) item.resolve(null);
  runs.delete(id);
}

export function hasRun(id: string): boolean {
  return runs.has(id);
}

/**
 * 사용자에게 묻고 기다린다.
 *
 * 답이 안 오면 영원히 멈춘다 — 그건 사용자가 화면을 닫은 경우이고, TTL 이
 * 청소한다. 시간 제한을 두지 않는 이유는 사람이 서류를 찾으러 갈 수 있기
 * 때문이다. 기다리는 동안 화면에는 무엇을 묻고 있는지 떠 있다.
 */
export function ask(
  runId: string,
  question: { id: string; label: string },
): Promise<string | null> {
  const run = runs.get(runId);
  if (!run) return Promise.resolve(null);
  return new Promise((resolve) => {
    run.pending.set(question.id, { ...question, resolve });
  });
}

/** 사용자가 답했다. 없는 질문이면 무시한다 */
export function answer(runId: string, id: string, value: string | null): boolean {
  const run = runs.get(runId);
  const item = run?.pending.get(id);
  if (!run || !item) return false;
  run.pending.delete(id);
  item.resolve(value);
  return true;
}

/** 사용자가 끼워 넣은 지시. `now` 면 지금 도는 것을 끊는다 */
export function steer(runId: string, text: string, mode: "now" | "next"): boolean {
  const run = runs.get(runId);
  if (!run) return false;
  run.steer.push(text);
  if (mode === "now") run.abort.abort(new Error("사용자 지시로 중단"));
  return true;
}

/** 쌓인 지시를 비우며 가져간다. 단계 경계에서 부른다 */
export function takeSteer(runId: string): string[] {
  const run = runs.get(runId);
  if (!run || run.steer.length === 0) return [];
  return run.steer.splice(0, run.steer.length);
}

export function signalOf(runId: string): AbortSignal | undefined {
  return runs.get(runId)?.abort.signal;
}
