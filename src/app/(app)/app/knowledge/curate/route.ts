import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";

import { curate } from "../_lib/curator";

export const maxDuration = 120;

/** 지식은 말로만 고친다. 직접 편집 대신 에이전트가 판단해 반영한다. */
export async function POST(req: Request) {
  if (!hasDb()) return Response.json({ error: "DB 미연결" }, { status: 503 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await req.json()) as { instruction?: string };
  const instruction = body.instruction?.trim();
  if (!instruction) {
    return Response.json({ error: "지시가 비어 있습니다." }, { status: 400 });
  }

  try {
    const result = await curate(session.user.id, instruction);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
