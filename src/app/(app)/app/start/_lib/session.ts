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

/**
 * 준비가 도는 동안 스냅샷을 덮어쓴다.
 *
 * **사용자가 탭을 닫아도 준비는 끝까지 간다.** 그런데 결과를 맨 끝에서 한 번만
 * 쓰면, 그 사이에 실패하거나 서버가 재시작되면 아무것도 안 남는다 — 사용자
 * 입장에서는 「긴 걸 시켜 놓고 나갔는데 흔적이 없다」가 된다.
 *
 * 단계가 끝날 때마다 갱신하면 지난 목표 목록에서 진행이 그대로 보이고,
 * 도중에 죽어도 어디까지 갔는지가 남는다.
 */
export async function updateSession(
  userId: string,
  id: string,
  snapshot: SessionSnapshot,
): Promise<boolean> {
  if (!hasDb()) return false;
  try {
    await getDb()
      .update(schema.goals)
      .set({
        title: snapshot.title,
        organization: snapshot.organization,
        deadline: snapshot.deadline,
        snapshot,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, userId)));
    return true;
  } catch (error) {
    console.error("[session] update", error);
    return false;
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

/**
 * 신청 결과를 남긴다.
 *
 * **사용자가 화면을 닫아도 서버는 계속 돈다** (실측: 클라이언트가 끊기면
 * `enqueue` 만 실패하고 실행 자체는 끝까지 간다). 그래서 결과를 여기 안 쓰면
 * 에이전트가 신청서를 제출해 놓고 아무 데도 기록하지 않는 상태가 된다 —
 * 사용자는 자기 이름으로 접수됐는지조차 알 수 없다.
 */
export async function saveApplyResult(
  userId: string,
  id: string,
  result: {
    summary: string | null;
    steps: number;
    mode: "auto" | "manual" | null;
    finishedAt: string;
    error?: string;
    /**
     * 무엇을 눌렀고 무엇이 돌아왔는가.
     *
     * 감사 추적이다. 사용자 명의로 실제 접수를 하는 이상, 「엉뚱한 값이
     * 들어갔다」는 신고를 재구성할 수 있어야 한다. 두 에이전트가 이미 성실히
     * 쌓고 있던 것을 여기서 버리고 있었다.
     */
    trace?: unknown[];
  },
): Promise<boolean> {
  if (!hasDb()) return false;
  try {
    await getDb()
      .update(schema.goals)
      .set({
        result,
        stage: result.error ? "working" : "waiting",
        updatedAt: new Date(),
      })
      .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, userId)));
    return true;
  } catch (error) {
    console.error("[session] saveApplyResult", error);
    return false;
  }
}
