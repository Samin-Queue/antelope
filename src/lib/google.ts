import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { GOOGLE_CONNECTIONS, type GoogleConnection } from "@/lib/google-scopes";

async function findGoogleAccount(headerList: Headers) {
  const accounts = await auth.api.listUserAccounts({ headers: headerList });
  return accounts.find((account) => account.providerId === "google") ?? null;
}

/** 어떤 기능이 이미 동의받았는지. `account.scope` 는 콜백에서 병합 저장된다. */
export async function googleConnections(): Promise<GoogleConnection[]> {
  const account = await findGoogleAccount(await headers());
  const granted = new Set(account?.scopes ?? []);
  return GOOGLE_CONNECTIONS.map((connection) => ({
    key: connection.key,
    label: connection.label,
    description: connection.description,
    scopes: [...connection.scopes],
    connected: connection.scopes.every((scope) => granted.has(scope)),
  }));
}

/**
 * 구글 API 를 부를 때 쓰는 액세스 토큰. 만료 5초 전이면 better-auth 가
 * refresh token 으로 갱신하고 DB 에 다시 쓴다.
 *
 * ⚠ `accountId` 는 `account` 테이블의 **행 id** 다. 구글 sub 인 `account.accountId`
 * 를 넣으면 1.7.x 는 ACCOUNT_NOT_FOUND 로 400 을 돌려준다.
 *
 * 요청한 스코프가 아직 동의되지 않았으면 null 이다 — 호출부는 이걸 보고
 * 연동 화면으로 안내한다. 없는 권한으로 API 를 때려 403 을 받지 않는다.
 */
export async function googleAccessToken(...scopes: string[]) {
  const headerList = await headers();
  const account = await findGoogleAccount(headerList);
  if (!account) return null;
  if (!scopes.every((scope) => account.scopes.includes(scope))) return null;

  const { accessToken } = await auth.api.getAccessToken({
    headers: headerList,
    body: { accountId: account.id },
  });
  return accessToken ?? null;
}
