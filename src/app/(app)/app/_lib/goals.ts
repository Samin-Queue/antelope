import { and, desc, eq } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";

/** 목표 하나 = 공고 하나에 대한 도전. 지난 목표 탭이 이걸 읽는다. */
export type GoalStage = "reviewing" | "working" | "waiting" | "closed";
export type GoalOutcome = "won" | "rejected" | "ineligible" | "deferred" | "abandoned";

export const STAGE_LABEL: Record<GoalStage, string> = {
  reviewing: "검토 중",
  working: "작업 중",
  waiting: "결과 대기 중",
  closed: "종료됨",
};

export const OUTCOME_LABEL: Record<GoalOutcome, string> = {
  won: "선정",
  rejected: "미선정",
  ineligible: "자격 미달",
  deferred: "나중에",
  abandoned: "접음",
};

export type Goal = {
  id: string;
  title: string;
  organization: string | null;
  deadline: string | null;
  stage: GoalStage;
  outcome: GoalOutcome | null;
  updatedAt: Date;
};

export async function listGoals(userId: string): Promise<Goal[]> {
  const db = getDb();
  return db
    .select({
      id: schema.goals.id,
      title: schema.goals.title,
      organization: schema.goals.organization,
      deadline: schema.goals.deadline,
      stage: schema.goals.stage,
      outcome: schema.goals.outcome,
      updatedAt: schema.goals.updatedAt,
    })
    .from(schema.goals)
    .where(eq(schema.goals.userId, userId))
    .orderBy(desc(schema.goals.updatedAt));
}

export async function createGoal(
  userId: string,
  input: {
    title: string;
    organization?: string | null;
    deadline?: string | null;
    notice?: unknown;
  },
): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(schema.goals)
    .values({
      userId,
      title: input.title,
      organization: input.organization ?? null,
      deadline: input.deadline ?? null,
      notice: input.notice as Record<string, unknown> | undefined,
    })
    .returning({ id: schema.goals.id });
  return row.id;
}

export async function updateGoal(
  userId: string,
  id: string,
  patch: { stage?: GoalStage; outcome?: GoalOutcome | null; result?: unknown },
): Promise<void> {
  const db = getDb();
  await db
    .update(schema.goals)
    .set({
      ...(patch.stage ? { stage: patch.stage } : {}),
      ...(patch.outcome !== undefined ? { outcome: patch.outcome } : {}),
      ...(patch.result !== undefined
        ? { result: patch.result as Record<string, unknown> }
        : {}),
      updatedAt: new Date(),
    })
    // 소유자까지 걸어야 남의 목표를 id 만으로 고칠 수 없다.
    .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, userId)));
}
