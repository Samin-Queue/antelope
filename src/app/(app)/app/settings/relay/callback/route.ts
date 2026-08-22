import { hasDb } from "@/lib/db";
import { exchange, verifyState } from "@/app/(labs)/lab/relay/_lib/oidc";
import { linkIdentity } from "@/app/(labs)/lab/relay/_lib/store";

import { siteOrigin } from "../route";

export const dynamic = "force-dynamic";

/**
 * 동의 화면에서 돌아오는 자리.
 *
 * **세션을 믿지 않고 `state` 를 믿는다.** 동의 화면을 거치는 동안 사용자가
 * 다른 계정으로 갈아탔을 수 있고, 그때 지금 로그인한 사람에게 슬랙 id 를
 * 붙이면 남의 계정이 연결된다. 누구의 연결이었는지는 서명된 state 안에 있다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = siteOrigin(url.origin);
  const back = (query: string) =>
    Response.redirect(`${origin}/app/settings?${query}`, 302);

  if (!hasDb()) return back("relay=error&why=no-db");

  const denied = url.searchParams.get("error");
  if (denied) return back(`relay=error&why=${encodeURIComponent(denied)}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back("relay=error&why=missing-code");

  const userId = state ? verifyState(state) : null;
  if (!userId) return back("relay=error&why=bad-state");

  const identity = await exchange(code, origin);
  if ("error" in identity) {
    return back(`relay=error&why=${encodeURIComponent(identity.error)}`);
  }

  await linkIdentity({
    userId,
    channel: "slack",
    externalId: identity.userId,
    workspaceId: identity.teamId,
    displayName: identity.name,
  });
  return back("relay=connected");
}
