/**
 * 구글 스코프 상수. 서버 전용인 `google.ts` 와 갈라 둔 이유는 클라이언트
 * 컴포넌트가 이 값을 그대로 쓰기 때문이다 — `google.ts` 는 `next/headers` 를
 * import 하므로 클라이언트 번들에 들어가면 빌드가 깨진다.
 */
export const GOOGLE_SCOPES = {
  /**
   * 좁은 `calendar.events` 가 아니라 full 이다. events CRUD·watch 는 events 로도
   * 되지만 `calendarList.list`(캘린더 골라 담기)와 `freebusy.query` 는 안 된다.
   * 둘 다 sensitive 등급이라 넓혀도 검증 부담이 같다.
   */
  calendar: "https://www.googleapis.com/auth/calendar",
  /**
   * `gmail.readonly` + `gmail.send` 대신 modify 하나. 읽기·발송·라벨·`users.watch`
   * 를 전부 덮는다. readonly 가 이미 restricted 라 어차피 등급이 안 내려간다.
   * (영구 삭제만 빠진다 — 그건 `https://mail.google.com/` 이 필요하다.)
   */
  gmail: "https://www.googleapis.com/auth/gmail.modify",
} as const;

/** 화면에 그리는 단위. 스코프 하나가 아니라 "기능" 하나가 연동의 단위다. */
export const GOOGLE_CONNECTIONS = [
  {
    key: "calendar",
    label: "Google 캘린더",
    description: "공고 마감일을 일정으로 만들고, 겹치는 일정을 미리 본다.",
    scopes: [GOOGLE_SCOPES.calendar],
  },
  {
    key: "gmail",
    label: "Gmail",
    description: "접수 확인 메일을 읽고, 제출 알림을 보낸다.",
    scopes: [GOOGLE_SCOPES.gmail],
  },
] as const;

/** 한 번의 동의로 전부 받을 때. 구글은 화면 하나에 항목을 나열해준다. */
export const GOOGLE_ALL_SCOPES: string[] = GOOGLE_CONNECTIONS.flatMap((connection) => [
  ...connection.scopes,
]);

/**
 * 동의 요청에 붙이는 파라미터.
 * - `access_type=offline` 이라야 refresh token 이 온다.
 * - `prompt=consent` 는 이미 동의한 계정에도 화면을 다시 띄운다. 없으면 재연동
 *   때 refresh token 이 안 온다 — 구글은 최초 1회만 준다.
 *
 * provider 전역(`socialProviders.google`)이 아니라 호출마다 붙인다. 전역이면
 * 스코프가 필요 없는 로그인에도 매번 동의 화면이 뜬다.
 */
export const GOOGLE_CONSENT_PARAMS = {
  access_type: "offline",
  prompt: "consent",
} as const;

export type GoogleConnection = {
  key: string;
  label: string;
  description: string;
  scopes: string[];
  connected: boolean;
};
