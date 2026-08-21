import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";

import { recallForFields } from "../_lib/memory";

export const maxDuration = 60;

/** 이 공고가 묻는 항목 중 이미 아는 것을 돌려준다. */
export async function POST(req: Request) {
  const body = (await req.json()) as { labels?: string[] };
  const labels = body.labels ?? [];

  // 로그인 전에도 폼은 떠야 한다. 아는 게 없을 뿐이다.
  if (!hasDb() || labels.length === 0) return Response.json({ known: {} });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ known: {} });

  try {
    const found = await recallForFields(session.user.id, labels);
    const known: Record<string, { value: string; label: string }> = {};
    for (const [asked, memory] of Object.entries(found)) {
      known[asked] = { value: memory.value, label: memory.label };
    }
    return Response.json({ known });
  } catch (error) {
    // 기억 조회 실패가 신청을 막아서는 안 된다.
    console.error("[recall]", error);
    return Response.json({ known: {} });
  }
}
