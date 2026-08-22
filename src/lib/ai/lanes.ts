/**
 * 레인 — 무엇을 몇 개까지 동시에 돌릴 것인가.
 *
 * 병렬화는 상한 없이 넣으면 개선이 아니라 새 장애다. 이 컨테이너에서 실제로
 * 먼저 죽는 자원은 토큰이 아니라 **Chromium** 이고, 지금 그 상한은 가장 덜
 * 쓰이는 경로에만 걸려 있다 — 수동 모드는 `desktop.ts` 의 `MAX_SESSIONS = 2`
 * 로 막혀 있는데, 기본 경로인 Playwright 자동 모드는 상한이 없고 신청 한 건이
 * `probeCaptcha` + 본 실행으로 둘을 띄운다. 게다가 `render/pdf.ts` 는 문서마다
 * 브라우저를 새로 연다. 문서 작성을 병렬로 바꾸는 순간 3편 = Chromium 6개다.
 *
 * 프로세스 메모리에 둔다. Railway `numReplicas: 1` 이라 그것으로 충분하고,
 * 인스턴스가 늘면 이 파일이 아니라 큐가 답이다.
 */
type Task<T> = () => Promise<T>;

class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(
    readonly name: string,
    readonly limit: number,
  ) {}

  /** 지금 도는 개수. `/api/health` 가 게이지로 노출한다 */
  get inFlight(): number {
    return this.active;
  }

  /** 자리를 기다리는 개수 */
  get waiting(): number {
    return this.queue.length;
  }

  async run<T>(task: Task<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      // 실패해도 반드시 다음 사람을 깨운다. 안 그러면 레인이 영영 막힌다.
      this.queue.shift()?.();
    }
  }
}

/**
 * Studio job. 업로드 → job → 폴링이라 한 건이 수십 초 매달린다.
 * 3 은 파일 세 개짜리 공고를 한 번에 처리하되 상류 rate limit 을 안 건드리는 선.
 */
const studio = new Semaphore("studio", 3);
/** 사람이 기다리는 모델 호출 */
const interactive = new Semaphore("interactive", 4);
/** 사람이 당장 안 보는 것 — 문서 작성처럼 */
const batch = new Semaphore("batch", 2);
/**
 * Chromium 을 띄우는 모든 것. `probeCaptcha`·`runPlaywrightAgent`·`renderPdf`·
 * Xvfb 세션이 **같은** 레인을 쓴다. 종류별로 나누면 합이 상한을 넘는다.
 */
const browser = new Semaphore("browser", 2);

export const lanes = {
  studio: <T>(task: Task<T>) => studio.run(task),
  interactive: <T>(task: Task<T>) => interactive.run(task),
  batch: <T>(task: Task<T>) => batch.run(task),
  browser: <T>(task: Task<T>) => browser.run(task),
};

export type LaneName = keyof typeof lanes;

/** 헬스체크용 게이지. 이 시스템이 실제로 죽는 방식은 단일 실행 프로파일러로 안 잡힌다 */
export function laneGauges(): Record<
  LaneName,
  { inFlight: number; waiting: number; limit: number }
> {
  const of = (s: Semaphore) => ({
    inFlight: s.inFlight,
    waiting: s.waiting,
    limit: s.limit,
  });
  return {
    studio: of(studio),
    interactive: of(interactive),
    batch: of(batch),
    browser: of(browser),
  };
}
