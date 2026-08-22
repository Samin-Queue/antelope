import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";

import { saveNeeds } from "../_lib/session";
import type { Need } from "../_lib/types";

/**
 * 마스터 테이블 갱신.
 *
 * 사용자가 값을 채우면 여기로 온다. 브라우저·파일 에이전트가 읽는 단일 진실이
 * 최신이어야 하므로 실행 직전이 아니라 **채울 때마다** 저장한다.
 */
const body = z.object({
  id: z.string().uuid(),
  needs: z.array(z.record(z.string(), z.unknown())).max(200),
});

export async function POST(req: Request) {
  if (!hasDb()) return Response.json({ ok: false });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ ok: false });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "id·needs 가 필요합니다." }, { status: 400 });
  }

  const ok = await saveNeeds(
    session.user.id,
    parsed.data.id,
    parsed.data.needs as unknown as Need[],
  );
  return Response.json({ ok });
}
