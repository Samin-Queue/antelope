import { z } from "zod";

import { hasSession, input, setHold } from "../_lib/desktop";

export const dynamic = "force-dynamic";

const point = { x: z.number().min(0).max(4096), y: z.number().min(0).max(4096) };

const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("click"), ...point }),
  z.object({ kind: z.literal("dblclick"), ...point }),
  z.object({ kind: z.literal("move"), ...point }),
  z.object({ kind: z.literal("drag"), ...point, toX: z.number(), toY: z.number() }),
  z.object({ kind: z.literal("scroll"), ...point, dy: z.number() }),
  z.object({ kind: z.literal("type"), text: z.string().max(2000) }),
  z.object({ kind: z.literal("key"), key: z.string().max(40) }),
  /** 조작권을 가져오거나 돌려준다. 잡고 있는 동안 에이전트는 다음 조작을 안 한다 */
  z.object({ kind: z.literal("hold"), held: z.boolean() }),
]);

/**
 * 사람의 조작을 가상 데스크톱에 넣는다.
 *
 * 좌표는 1280×900 기준이다. X 서버로 직접 들어가므로 캡챠 iframe 안이든
 * 브라우저 밖이든 구분 없이 눌린다 — CDP 로는 못 하던 일이다.
 */
export async function POST(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("session");
  if (!sessionId || !hasSession(sessionId)) {
    return Response.json({ error: "세션이 없습니다." }, { status: 404 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const action = parsed.data;
  if (action.kind === "hold") {
    setHold(sessionId, action.held);
    return Response.json({ ok: true, held: action.held });
  }

  try {
    await input(sessionId, action);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
