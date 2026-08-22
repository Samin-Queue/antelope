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

/** 세션 하나. 저장해 둔 공고 객체와 파이프라인 결과가 통째로 들어 있다. */
export async function getGoal(
  userId: string,
  id: string,
): Promise<(Goal & { notice: unknown; result: unknown; snapshot: unknown }) | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.goals)
    .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, userId)))
    .limit(1);
  return row ?? null;
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

/**
 * 세션 하나를 지운다.
 *
 * 소유자까지 걸어야 남의 세션을 id 만으로 지울 수 없다 — `updateGoal` 과 같은
 * 이유다. 지운 뒤 몇 줄이 지워졌는지 돌려주므로, 없는 id 와 남의 id 를
 * 호출부가 같은 「못 찾음」으로 묶을 수 있다. 남의 것이 존재한다는 사실 자체를
 * 알려 줄 이유가 없다.
 */
export async function deleteGoal(userId: string, id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .delete(schema.goals)
    .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, userId)))
    .returning({ id: schema.goals.id });
  return rows.length > 0;
}

/** 이 사용자의 세션을 전부 지운다. 설정의 초기화가 부른다 */
export async function deleteAllGoals(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .delete(schema.goals)
    .where(eq(schema.goals.userId, userId))
    .returning({ id: schema.goals.id });
  return rows.length;
}
