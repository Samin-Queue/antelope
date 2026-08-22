import { currentSession } from "@/lib/session";

import { deleteGoal } from "../../../_lib/goals";

export const dynamic = "force-dynamic";

/**
 * 세션 하나를 지운다.
 *
 * 인증은 프록시(`/app/:path*`)가 이미 강제한다. 여기서 봐야 하는 것은 **인가** —
 * 이 세션이 내 것인가다. `deleteGoal` 이 `userId` 까지 걸어 지우므로 남의 id 는
 * 애초에 0줄이 지워지고, 그것을 「없는 세션」과 같은 404 로 묶는다. 남의 세션이
 * 존재한다는 사실 자체를 알려 줄 이유가 없다.
 *
 * ⚠ GET 으로 열지 않는다. 링크·프리페치·크롤러가 지나가기만 해도 지워진다.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await ctx.params;
  const deleted = await deleteGoal(session.user.id, id);
  if (!deleted) return Response.json({ error: "없는 세션입니다." }, { status: 404 });
  return Response.json({ ok: true });
}
