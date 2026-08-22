import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { env } from "@/lib/env";
import { authorizeUrl, oidcReady, signState } from "@/app/(labs)/lab/relay/_lib/oidc";
import { unlinkIdentity } from "@/app/(labs)/lab/relay/_lib/store";

export const dynamic = "force-dynamic";

/**
 * 슬랙 계정 연결의 시작과 해제.
 *
 * `/app/*` 아래에 둔다 — `src/proxy.ts` 가 DB 세션까지 검증해 막아 주는 유일한
 * 구역이다. `/lab/*` 에 두면 로그인 없이 연결 흐름을 시작할 수 있고, 그 state 는
 * **아무 계정에나 슬랙 id 를 붙이는 열쇠**가 된다.
 */

/**
 * 우리 자신의 주소.
 *
 * `redirect_uri` 는 슬랙에 등록한 값과 **글자 그대로** 같아야 하므로 요청에서
 * 추측하지 않는다. 프록시 뒤에서는 `req.url` 이 내부 주소일 수 있다.
 */
export function siteOrigin(fallback: string): string {
  return (env.BETTER_AUTH_URL || fallback).replace(/\/+$/, "");
}

export async function GET(req: Request) {
  if (!hasDb()) return Response.json({ error: "DB 가 없습니다." }, { status: 503 });
  if (!oidcReady()) {
    return Response.json(
      { error: "SLACK_CLIENT_ID·SLACK_CLIENT_SECRET 이 설정되지 않았습니다." },
      { status: 503 },
    );
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const origin = siteOrigin(new URL(req.url).origin);
  return Response.redirect(authorizeUrl(origin, signState(session.user.id)), 302);
}

const del = z.object({ id: z.string().uuid() });

export async function DELETE(req: Request) {
  if (!hasDb()) return Response.json({ error: "DB 가 없습니다." }, { status: 503 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const parsed = del.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "id 가 필요합니다." }, { status: 400 });
  }
  // 소유자 대조는 쿼리 안에 있다 — 남의 연동을 지울 수 없다.
  await unlinkIdentity(session.user.id, parsed.data.id);
  return Response.json({ ok: true });
}
