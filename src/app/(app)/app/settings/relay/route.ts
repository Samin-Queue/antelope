import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { issueLinkCode, unlinkIdentity } from "@/app/(labs)/lab/relay/_lib/store";

export const dynamic = "force-dynamic";

/**
 * 슬랙 연동 코드 발급·해제.
 *
 * `/app/*` 아래에 둔다 — `src/proxy.ts` 가 DB 세션까지 검증해 막아 주는 유일한
 * 구역이다. `/lab/*` 에 두면 로그인 없이 코드를 찍어낼 수 있고, 그 코드는
 * **아무 계정에나 슬랙 id 를 붙이는 열쇠**다.
 */
export async function POST() {
  if (!hasDb()) return Response.json({ error: "DB 가 없습니다." }, { status: 503 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const code = await issueLinkCode(session.user.id);
  return Response.json({ code, expiresInMinutes: 10 });
}

const del = z.object({ id: z.string().uuid() });

export async function DELETE(req: Request) {
  if (!hasDb()) return Response.json({ error: "DB 가 없습니다." }, { status: 503 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const parsed = del.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "id 가 필요합니다." }, { status: 400 });

  // 소유자 대조는 쿼리 안에 있다 — 남의 연동을 지울 수 없다.
  await unlinkIdentity(session.user.id, parsed.data.id);
  return Response.json({ ok: true });
}
