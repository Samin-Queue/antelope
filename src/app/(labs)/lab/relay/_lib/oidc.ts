import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * 「슬랙 계정 연결」 — Sign in with Slack (OpenID Connect).
 *
 * 연동 코드를 손으로 옮기게 하거나 이메일이 같기를 바라는 대신, **사용자가
 * 동의 화면에서 한 번 누른다.** 구글 캘린더 연동과 같은 모양이고, 이 저장소가
 * 이미 그 패턴(`linkSocial` + `/app/settings`)을 쓴다.
 *
 * 슬랙 봇 설치(`xoxb-`)와는 **다른 축**이다. 봇 설치는 워크스페이스에 앱을
 * 넣는 것이고, 이건 「이 슬랙 사람 = 이 Antelope 사용자」를 잇는 것이다.
 *
 * ⚠ 아래 엔드포인트·필드는 슬랙 OIDC 문서 기준이고 이 파일을 쓰는 시점에
 * 호출해 본 적이 없다. 첫 연결 시도가 검증이다.
 */

const AUTHORIZE = "https://slack.com/openid/connect/authorize";
const TOKEN = "https://slack.com/api/openid.connect.token";
const USERINFO = "https://slack.com/api/openid.connect.userInfo";

/** 동의 화면에서 받는 것. 신원 확인에 필요한 최소치다 */
const SCOPES = "openid email profile";

/** state 유효 시간. 동의 화면에 머무는 시간만 있으면 된다 */
const STATE_TTL_MS = 10 * 60 * 1000;

export function oidcReady(): boolean {
  return Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET);
}

function secret(): string {
  return env.BETTER_AUTH_SECRET ?? "dev-only-insecure-secret-change-me";
}

/**
 * state 를 서명해 들고 다닌다.
 *
 * 서버에 저장하지 않는 이유는 **인스턴스가 재시작해도 진행 중인 동의가 살아야**
 * 하기 때문이다. 누가 이 값을 만들 수 없어야 하므로 HMAC 으로 묶고, 만료를 넣어
 * 재사용을 막는다.
 */
export function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}.${randomBytes(8).toString("hex")}`;
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

export function verifyState(state: string): string | null {
  const [encoded, mac] = state.split(".");
  if (!encoded || !mac) return null;
  const payload = Buffer.from(encoded, "base64url").toString();
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [userId, issuedAt] = payload.split(".");
  if (!userId || !issuedAt) return null;
  if (Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;
  return userId;
}

export function authorizeUrl(origin: string, state: string): string {
  const url = new URL(AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("client_id", env.SLACK_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * 슬랙 앱 설정의 Redirect URLs 에 **글자 그대로** 이 값이 있어야 한다.
 * 하나라도 다르면 `bad_redirect_uri` 로 돌아온다.
 */
export function redirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/app/settings/relay/callback`;
}

export type SlackIdentity = {
  userId: string;
  teamId: string | null;
  email: string | null;
  name: string | null;
};

/**
 * code 를 신원으로 바꾼다.
 *
 * `id_token`(JWT)을 직접 까지 않고 `userInfo` 를 부른다 — 서명 검증과 키 회전을
 * 우리가 떠안을 이유가 없고, 필요한 값이 전부 그 응답에 있다.
 */
export async function exchange(
  code: string,
  origin: string,
): Promise<SlackIdentity | { error: string }> {
  const body = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID ?? "",
    client_secret: env.SLACK_CLIENT_SECRET ?? "",
    code,
    redirect_uri: redirectUri(origin),
  });

  try {
    const tokenRes = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body,
    });
    const token = (await tokenRes.json()) as {
      ok: boolean;
      error?: string;
      access_token?: string;
    };
    // ⚠ 슬랙은 실패도 200 + {ok:false} 로 준다. 상태 코드만 보면 성공으로 읽는다.
    if (!token.ok || !token.access_token) {
      return { error: token.error ?? "token_exchange_failed" };
    }

    const infoRes = await fetch(USERINFO, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const info = (await infoRes.json()) as {
      ok: boolean;
      error?: string;
      sub?: string;
      email?: string;
      name?: string;
      "https://slack.com/user_id"?: string;
      "https://slack.com/team_id"?: string;
    };
    if (!info.ok) return { error: info.error ?? "userinfo_failed" };

    // `sub` 도 슬랙 user id 지만, 팀이 섞인 환경에서 확실한 것은 명시 필드다.
    const userId = info["https://slack.com/user_id"] ?? info.sub;
    if (!userId) return { error: "no_user_id" };

    return {
      userId,
      teamId: info["https://slack.com/team_id"] ?? null,
      email: info.email ?? null,
      name: info.name ?? null,
    };
  } catch (error) {
    console.error("[relay/oidc] 교환 실패", error);
    return { error: error instanceof Error ? error.message : "exchange_error" };
  }
}
