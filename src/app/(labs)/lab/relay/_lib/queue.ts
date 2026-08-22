/**
 * 동시 실행 상한.
 *
 * 준비 한 건이 실제로 잡는 것: Studio job 2건(각 45~180초, `upstage-studio.ts:158`),
 * 문서를 만들 때마다 Chromium(`render/pdf.ts`), 신청까지 가면 Chromium 2개 더
 * (`apply/route.ts` 의 probe + 본 실행). 멘션 세 통이면 그만큼이 곱해진다.
 *
 * `/api/health` 가 경고하는 OOM 이 그 자리다. 릴레이는 자기 폴더 안에서 자체
 * 상한을 건다 — LLM 계층 개편의 `lanes.browser` 가 들어와도 이중 상한이라 무해하다.
 */

/** 동시에 도는 실행. 이 컨테이너가 감당하는 수 */
const MAX_ACTIVE = 2;

/** 자리를 기다리는 최대 시간. 넘으면 거절하고 다시 부르라고 말한다 */
const WAIT_TIMEOUT_MS = 10 * 60 * 1000;

let active = 0;
const waiters: Array<() => void> = [];
/** 지금 실행 중인 사용자. 한 사람이 둘을 동시에 돌리면 스레드가 섞인다 */
const running = new Set<string>();

export type Release = () => void;

export type Acquired =
  { ok: true; release: Release } | { ok: false; why: "busy" | "timeout" };

export async function acquire(
  userId: string,
  onQueued?: (ahead: number) => void,
): Promise<Acquired> {
  if (running.has(userId)) return { ok: false, why: "busy" };
  running.add(userId);

  if (active >= MAX_ACTIVE) {
    onQueued?.(waiters.length + 1);
    const got = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        const i = waiters.indexOf(wake);
        if (i >= 0) waiters.splice(i, 1);
        resolve(false);
      }, WAIT_TIMEOUT_MS);
      const wake = () => {
        clearTimeout(timer);
        resolve(true);
      };
      waiters.push(wake);
    });
    if (!got) {
      running.delete(userId);
      return { ok: false, why: "timeout" };
    }
    // 자리를 **넘겨받았다.** active 는 앞사람이 들고 있던 것이 그대로 옮겨온 것이라
    // 여기서 올리지 않는다 — 올리면 상한을 넘는다.
  } else {
    active += 1;
  }

  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      running.delete(userId);
      const next = waiters.shift();
      // 자리를 다음 사람에게 그대로 넘긴다. 비웠다가 채우면 그 틈에 새 요청이
      // 상한 검사를 통과해 셋이 동시에 돈다.
      if (next) next();
      else active -= 1;
    },
  };
}

/** 화면에 그릴 현재 상태 */
export function queueStatus() {
  return { active, waiting: waiters.length, max: MAX_ACTIVE };
}
