import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";

import { answer, hasRun, steer } from "../_lib/run-registry";

export const dynamic = "force-dynamic";

/**
 * 실행 중인 신청에 사람이 끼어드는 통로.
 *
 * SSE 는 단방향이라 별도 요청이 와야 한다. 두 가지가 온다 —
 * 에이전트가 물은 것에 대한 **답**과, 사용자가 먼저 거는 **지시**.
 *
 * 지시는 기본이 `next` 다. 지금 도는 조작을 끊으면 반쯤 채운 폼이 남는다 —
 * 단계 경계에서 받는 편이 안전하고, 급할 때만 `now` 로 끊는다.
 */
const body = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("answer"),
    runId: z.string().min(8).max(64),
    id: z.string().min(1).max(80),
    value: z.string().max(4000).nullable(),
  }),
  z.object({
    kind: z.literal("steer"),
    runId: z.string().min(8).max(64),
    text: z.string().min(1).max(2000),
    mode: z.enum(["now", "next"]).default("next"),
  }),
]);

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "형식이 맞지 않습니다." }, { status: 400 });
  }
  const data = parsed.data;

  /**
   * 인증은 프록시(`/app/:path*`)가 이미 강제한다. 여기서 봐야 하는 것은
   * **인가** — 이 `runId` 가 내 실행인가다. 없으면 로그인한 아무 사용자가
   * 남의 신청 폼에 값을 꽂을 수 있다. 「없는 실행」과 같은 404 로 답한다:
   * 남의 runId 가 존재한다는 사실 자체를 알려 줄 이유가 없다.
   */
  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;
  const userId = session?.user.id ?? null;

  if (!hasRun(data.runId, userId)) {
    return Response.json({ error: "끝났거나 없는 실행입니다." }, { status: 404 });
  }

  if (data.kind === "answer") {
    return Response.json({ ok: answer(data.runId, userId, data.id, data.value) });
  }
  return Response.json({ ok: steer(data.runId, userId, data.text, data.mode) });
}
