import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import type { Notice } from "@/app/(labs)/lab/notice/_lib/schema";

import { createGoal, updateGoal, type GoalOutcome, type GoalStage } from "../_lib/goals";

/**
 * 목표의 생애주기. 공고를 읽는 것만으로는 목표가 아니고 신청 준비에 들어간
 * 순간부터 목표다 — 그래서 프로필을 제출할 때 만들고 파이프라인 결과로 갱신한다.
 *
 * 로그인·DB 가 없으면 조용히 건너뛴다. 저장 실패가 신청을 막으면 안 된다.
 */
async function userId(): Promise<string | null> {
  if (!hasDb()) return null;
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function POST(req: Request) {
  const uid = await userId();
  if (!uid) return Response.json({ id: null });

  const { notice } = (await req.json()) as { notice?: Notice };
  if (!notice?.title) {
    return Response.json({ error: "notice 가 필요합니다." }, { status: 400 });
  }

  try {
    const id = await createGoal(uid, {
      title: notice.title,
      organization: notice.organization,
      deadline: notice.deadline,
      notice,
    });
    return Response.json({ id });
  } catch (error) {
    console.error("[goals] create", error);
    return Response.json({ id: null });
  }
}

export async function PATCH(req: Request) {
  const uid = await userId();
  if (!uid) return Response.json({ ok: false });

  const body = (await req.json()) as {
    id?: string;
    stage?: GoalStage;
    outcome?: GoalOutcome | null;
    result?: unknown;
  };
  if (!body.id) return Response.json({ error: "id 가 필요합니다." }, { status: 400 });

  try {
    await updateGoal(uid, body.id, {
      stage: body.stage,
      outcome: body.outcome,
      result: body.result,
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[goals] update", error);
    return Response.json({ ok: false });
  }
}
