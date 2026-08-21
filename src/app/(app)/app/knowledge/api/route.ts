import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import {
  forgetMemory,
  remember,
  updateMemory,
} from "@/app/(labs)/lab/notice/_lib/memory";

export const maxDuration = 60;

async function requireUser() {
  if (!hasDb()) return null;
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!userId) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await req.json()) as {
    action?: "create" | "update" | "delete";
    id?: string;
    label?: string;
    value?: string;
    kind?: "fact" | "item" | "strength" | "narrative";
  };

  try {
    if (body.action === "delete" && body.id) {
      await forgetMemory(userId, body.id);
    } else if (body.action === "update" && body.id) {
      await updateMemory(userId, body.id, {
        label: body.label,
        value: body.value,
        kind: body.kind,
      });
    } else if (body.label && body.value) {
      await remember(userId, [
        { kind: body.kind ?? "fact", label: body.label, value: body.value },
      ]);
    } else {
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
