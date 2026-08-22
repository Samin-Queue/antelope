import { and, eq } from "drizzle-orm";

import { getDb, hasDb, schema } from "@/lib/db";

import type { Need, SessionSnapshot } from "./types";

/**
 * 세션 저장.
 *
 * **서버가 쓴다.** 클라이언트가 저장을 맡으면 탭을 닫거나 새로고침한 순간
 * 준비한 것이 통째로 사라진다 — 요약도, 모아 온 파일도, 채워 둔 값도.
 * 사용자가 「신청 시작」을 눌러야 남는 구조도 같은 문제다: 준비만 하고
 * 나중에 이어서 하려던 사람에게는 아무것도 안 남는다.
 *
 * 실패는 삼킨다. 저장이 안 됐다고 신청을 막지 않는다.
 */
export async function createSession(
  userId: string,
  snapshot: SessionSnapshot,
): Promise<string | null> {
  if (!hasDb()) return null;
  try {
    const [row] = await getDb()
      .insert(schema.goals)
      .values({
        userId,
        title: snapshot.title,
        organization: snapshot.organization,
        deadline: snapshot.deadline,
        snapshot,
      })
      .returning({ id: schema.goals.id });
    return row?.id ?? null;
  } catch (error) {
    console.error("[session] create", error);
    return null;
  }
}

/** 마스터 테이블만 갈아끼운다. 사용자가 값을 채울 때마다 불린다. */
export async function saveNeeds(
  userId: string,
  id: string,
  needs: Need[],
): Promise<boolean> {
  if (!hasDb()) return false;
  try {
    const db = getDb();
    const [row] = await db
      .select({ snapshot: schema.goals.snapshot })
      .from(schema.goals)
      .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, userId)))
      .limit(1);
    if (!row) return false;

    const next = { ...(row.snapshot as SessionSnapshot), needs };
    await db
      .update(schema.goals)
      .set({ snapshot: next, updatedAt: new Date() })
      .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, userId)));
    return true;
  } catch (error) {
    console.error("[session] saveNeeds", error);
    return false;
  }
}
