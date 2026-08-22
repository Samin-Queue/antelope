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
  /** 사용자가 끼워 넣은 지시. 조작 하나가 끝난 자리에서 꺼낸다 */
  steer: string[];
  createdAt: number;
};

const runs = new Map<string, Run>();
const TTL_MS = 30 * 60 * 1000;

/**
 * 답을 기다리는 최대 시간.
 *
 * 없으면 사용자가 화면을 닫은 순간 그 실행이 **영원히 파킹된다** — `finally` 에
 * 닿지 못하니 Chromium·Xvfb 도 안 닫힌다. 사람이 서류를 찾으러 갈 수 있어야
 * 하므로 짧게 잡지 않는다.
 */
const ANSWER_TIMEOUT_MS = 15 * 60 * 1000;

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
  const run: Run = { pending: new Map(), steer: [], createdAt: Date.now() };
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
 * **반드시 끝난다.** 시간 제한이 없으면 화면을 닫은 사용자 때문에 실행이
 * 영원히 파킹되고, `finally` 에 닿지 못해 Chromium·Xvfb 가 그대로 남는다
 * (`sweep()` 은 새 실행이 열릴 때만 돌아서 구제가 안 된다).
 * 사람이 서류를 찾으러 갈 시간은 준다 — 그동안 화면에는 무엇을 묻는지 떠 있다.
 */
export function ask(
  runId: string,
  question: { id: string; label: string },
): Promise<string | null> {
  const run = runs.get(runId);
  if (!run) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      run.pending.delete(question.id);
      resolve(null);
    }, ANSWER_TIMEOUT_MS);
    run.pending.set(question.id, {
      ...question,
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
    });
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

/**
 * 사용자가 끼워 넣은 지시.
 *
 * 전달은 **조작 하나가 끝난 자리**에서 일어난다 — 도구 결과 문자열이 모델이
 * 다음에 읽는 전부이고, 도는 중간을 끊으면 반쯤 채운 폼이 남기 때문이다.
 * `now` 는 그래서 「더 빨리 닿는 것」이 아니라 **더 센 말**이다: 하던 것을
 * 멈추라고 지시문에 적어 보낸다. 실제 전달 시점은 둘 다 다음 조작 직후다.
 */
export function steer(runId: string, text: string, mode: "now" | "next"): boolean {
  const run = runs.get(runId);
  if (!run) return false;
  run.steer.push(
    mode === "now" ? `지금 하던 것을 멈추고 이것부터 따르라: ${text}` : text,
  );
  return true;
}

/** 쌓인 지시를 비우며 가져간다. 조작 하나가 끝날 때마다 부른다 */
export function takeSteer(runId: string): string[] {
  const run = runs.get(runId);
  if (!run || run.steer.length === 0) return [];
  return run.steer.splice(0, run.steer.length);
}
