/**
 * 릴레이 채널 계약.
 *
 * 슬랙과 텔레그램의 차이는 **어댑터 안에서 끝나야 한다.** 호스트가 `thread_ts`
 * 나 `trigger_id` 같은 슬랙 개념을 알기 시작하면 두 번째 채널을 붙일 때
 * 리팩터가 되고, 그때는 이미 늦다.
 *
 * 설계: docs/superpowers/plans/2026-08-22-relay-channels.md
 */

export type ChannelId = "slack" | "telegram";

/** 대화 한 줄기. 슬랙은 채널+thread_ts, 텔레그램은 chat+최초 message_id */
export type ThreadRef = {
  channel: ChannelId;
  conversation: string;
  thread: string;
  /** 슬랙 team_id. 텔레그램은 워크스페이스 개념이 없어 null */
  workspaceId: string | null;
};

export type IncomingFile = {
  name: string;
  mime: string;
  bytes: number;
  /**
   * 실제로 내려받는다.
   *
   * 목록만 보고 넘길 수 있어야 한다 — 25MB 짜리 첨부를 웹훅 처리 중에 무조건
   * 받아 두면 3초 안에 200 을 돌려주지 못한다. 토큰이 필요하므로 어댑터가
   * 클로저로 들고 있다.
   */
  download: () => Promise<Blob>;
};

export type Incoming = {
  ref: ThreadRef;
  /** 채널 안의 발신자 id. 슬랙 `U…` */
  from: string;
  displayName: string | null;
  /** 봇 멘션을 걷어낸 본문 */
  text: string;
  files: IncomingFile[];
  /** 멱등 키. 슬랙 event_id · 텔레그램 update_id */
  eventId: string;
  /**
   * 1:1 대화인가.
   *
   * 연동 코드는 **여기서만** 받는다. 공개 채널에 코드를 적으면 그것을 본
   * 사람이 먼저 써서 남의 계정에 자기 슬랙 id 를 붙일 수 있다.
   */
  isDirect: boolean;
};

/**
 * 웹훅 본문을 해석한 결과.
 *
 * `challenge` 는 슬랙이 Request URL 을 등록할 때 한 번 보내는 확인 절차다.
 * 이걸 빼먹으면 앱 설정 화면에서 URL 저장 자체가 안 된다.
 */
export type Parsed =
  | { kind: "message"; incoming: Incoming }
  | { kind: "challenge"; challenge: string }
  | { kind: "ignore"; why: string };

export interface RelayChannel {
  id: ChannelId;
  /** 설정이 없으면 false. 라우트는 503 을 돌려주고 앱은 그대로 뜬다 */
  ready(): boolean;
  /**
   * 서명 검증.
   *
   * ⚠ **원문 문자열이 필요하다.** `req.json()` 을 먼저 부르면 서명 계산에 쓸
   * 바이트가 사라진다. 라우트는 `await req.text()` → 검증 → `JSON.parse` 순서다.
   */
  verify(req: Request, rawBody: string): boolean;
  parse(rawBody: string): Parsed;

  /** 스레드에 새 댓글. 반환값은 나중에 고칠 때 쓰는 손잡이 */
  post(ref: ThreadRef, text: string): Promise<string | null>;
  /** 이미 보낸 메시지를 고친다. 진행 표시줄이 이걸로 산다 */
  edit(ref: ThreadRef, messageId: string, text: string): Promise<void>;
  /** 그 사람을 부르는 표기 */
  mention(externalId: string): string;
}
