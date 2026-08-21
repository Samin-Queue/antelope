import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";

import { remember } from "../_lib/memory";

export const maxDuration = 60;

/** 신청 준비에 쓴 정보를 지식베이스에 남긴다. 다음 공고에서 다시 묻지 않기 위해서다. */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    profile?: Record<string, string>;
    sourceNotice?: string;
    kinds?: Record<string, "fact" | "item" | "strength" | "narrative">;
  };

  if (!hasDb()) return Response.json({ saved: 0 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ saved: 0 });

  const entries = Object.entries(body.profile ?? {})
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => ({
      // 긴 서술은 사실이 아니라 서술로 분류해 나중에 사업계획 작성에 쓴다.
      kind:
        body.kinds?.[label] ??
        (value.length > 60 ? ("narrative" as const) : ("fact" as const)),
      label,
      value,
      sourceNotice: body.sourceNotice,
    }));

  if (entries.length === 0) return Response.json({ saved: 0 });

  try {
    const saved = await remember(session.user.id, entries);
    return Response.json({ saved });
  } catch (error) {
    console.error("[save]", error);
    return Response.json({ saved: 0 });
  }
}
