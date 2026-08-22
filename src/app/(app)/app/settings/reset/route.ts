import { z } from "zod";

import { currentSession } from "@/lib/session";
import { forgetAllMemories } from "@/app/(labs)/lab/notice/_lib/memory";

import { deleteAllGoals } from "../../_lib/goals";
import { deleteAllDocuments } from "../../start/_lib/documents";

export const dynamic = "force-dynamic";

/**
 * 되돌릴 수 없는 초기화. 무엇을 지울지는 **본문이 정한다.**
 *
 * 「지식베이스」는 사용자가 데이터 허브에서 보는 것 전부다 — 기억(`memories`)과
 * 보관 서류(`user_documents`) 둘 다. 화면에 한 덩어리로 보이는 것을 절반만
 * 지우면, 사용자는 초기화했는데 남아 있는 것을 보고 무엇이 지워졌는지 모른다.
 *
 * 몇 개가 지워졌는지 돌려준다. 「완료」만 띄우면 정말 지워졌는지 알 수 없다.
 */
const body = z.object({ scope: z.enum(["sessions", "knowledge"]) });

export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "형식이 맞지 않습니다." }, { status: 400 });
  }

  const userId = session.user.id;
  if (parsed.data.scope === "sessions") {
    return Response.json({ ok: true, goals: await deleteAllGoals(userId) });
  }

  const [memories, documents] = await Promise.all([
    forgetAllMemories(userId),
    deleteAllDocuments(userId),
  ]);
  return Response.json({ ok: true, memories, documents });
}
