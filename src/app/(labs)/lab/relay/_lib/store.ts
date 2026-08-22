import { randomInt } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import { getDb, hasDb, schema } from "@/lib/db";

import type { ChannelId, ThreadRef } from "./channel";

/**
 * 릴레이의 DB 접근. 여기 밖에서 `relay_*` 테이블을 건드리지 않는다.
 *
 * 실험을 접을 때 지울 것이 이 파일과 스키마 블록 하나로 끝나야 한다.
 */

/** 워크스페이스가 없는 채널(텔레그램)도 유니크 인덱스에 걸리게 정규화한다.
 *  postgres 에서 `null` 은 서로 같지 않아, null 을 그대로 넣으면 중복이 뚫린다. */
const ws = (value: string | null | undefined) => value ?? "";

/* ── 멱등 ──────────────────────────────────────────────────────────────── */

/**
 * 이미 처리한 이벤트인가.
 *
 * 슬랙은 3초 안에 200 을 못 받으면 같은 이벤트를 다시 보낸다. 조회 후 삽입으로
 * 나누면 재시도 둘이 같은 순간에 들어왔을 때 둘 다 통과한다 — **삽입이 곧
 * 판정**이어야 한다.
 */
export async function seenEvent(id: string): Promise<boolean> {
  if (!hasDb()) return false;
  const rows = await getDb()
    .insert(schema.relayEvents)
    .values({ id })
    .onConflictDoNothing()
    .returning({ id: schema.relayEvents.id });
  return rows.length === 0;
}

/* ── 신원 ──────────────────────────────────────────────────────────────── */

export type Identity = {
  userId: string;
  displayName: string | null;
};

export async function findIdentity(
  channel: ChannelId,
  externalId: string,
  workspaceId: string | null,
): Promise<Identity | null> {
  if (!hasDb()) return null;
  const [row] = await getDb()
    .select({
      userId: schema.relayIdentities.userId,
      displayName: schema.relayIdentities.displayName,
    })
    .from(schema.relayIdentities)
    .where(
      and(
        eq(schema.relayIdentities.channel, channel),
        eq(schema.relayIdentities.externalId, externalId),
        eq(schema.relayIdentities.workspaceId, ws(workspaceId)),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 사용자가 이 채널에 연동해 둔 계정. 설정 화면이 읽는다 */
export async function identitiesOf(userId: string) {
  if (!hasDb()) return [];
  return getDb()
    .select()
    .from(schema.relayIdentities)
    .where(eq(schema.relayIdentities.userId, userId))
    .orderBy(desc(schema.relayIdentities.createdAt));
}

async function linkIdentity(args: {
  userId: string;
  channel: ChannelId;
  externalId: string;
  workspaceId: string | null;
  displayName: string | null;
}): Promise<void> {
  await getDb()
    .insert(schema.relayIdentities)
    .values({ ...args, workspaceId: ws(args.workspaceId) })
    .onConflictDoUpdate({
      // 다시 연동하면 주인이 바뀐다. 행을 늘리지 않는다.
      target: [
        schema.relayIdentities.channel,
        schema.relayIdentities.externalId,
        schema.relayIdentities.workspaceId,
      ],
      set: { userId: args.userId, displayName: args.displayName },
    });
}

export async function unlinkIdentity(userId: string, id: string): Promise<void> {
  if (!hasDb()) return;
  await getDb()
    .delete(schema.relayIdentities)
    .where(
      and(eq(schema.relayIdentities.id, id), eq(schema.relayIdentities.userId, userId)),
    );
}

/* ── 연동 코드 ─────────────────────────────────────────────────────────── */

/** 혼동 문자(I·O·0·1)를 뺀다. 사람이 슬랙 DM 창에 손으로 옮겨 적는 값이다 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 10 * 60 * 1000;

export async function issueLinkCode(userId: string): Promise<string> {
  const code = Array.from(
    { length: 8 },
    () => ALPHABET[randomInt(ALPHABET.length)],
  ).join("");
  await getDb()
    .insert(schema.relayLinkCodes)
    .values({ code, userId, expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  return code;
}

export type CodeResult =
  | { ok: true; userId: string }
  | { ok: false; why: "unknown" | "expired" | "used" };

/**
 * 코드를 쓴다.
 *
 * 만료·재사용을 **구분해서** 돌려준다. 「코드가 올바르지 않습니다」 하나로
 * 뭉치면 10분이 지난 사람이 코드를 다시 발급받을 생각을 못 한다.
 */
export async function consumeLinkCode(
  code: string,
  target: {
    channel: ChannelId;
    externalId: string;
    workspaceId: string | null;
    displayName: string | null;
  },
): Promise<CodeResult> {
  if (!hasDb()) return { ok: false, why: "unknown" };
  const db = getDb();

  // 아직 안 쓰였고 만료 전인 행만 표시한다. 두 요청이 겹쳐도 하나만 이긴다.
  const [claimed] = await db
    .update(schema.relayLinkCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.relayLinkCodes.code, code),
        isNull(schema.relayLinkCodes.usedAt),
        gt(schema.relayLinkCodes.expiresAt, new Date()),
      ),
    )
    .returning({ userId: schema.relayLinkCodes.userId });

  if (!claimed) {
    const [row] = await db
      .select({
        usedAt: schema.relayLinkCodes.usedAt,
        expiresAt: schema.relayLinkCodes.expiresAt,
      })
      .from(schema.relayLinkCodes)
      .where(eq(schema.relayLinkCodes.code, code))
      .limit(1);
    if (!row) return { ok: false, why: "unknown" };
    return { ok: false, why: row.usedAt ? "used" : "expired" };
  }

  await linkIdentity({ userId: claimed.userId, ...target });
  return { ok: true, userId: claimed.userId };
}

/* ── 스레드 ────────────────────────────────────────────────────────────── */

export type ThreadRow = typeof schema.relayThreads.$inferSelect;

export async function findThread(ref: ThreadRef): Promise<ThreadRow | null> {
  if (!hasDb()) return null;
  const [row] = await getDb()
    .select()
    .from(schema.relayThreads)
    .where(
      and(
        eq(schema.relayThreads.channel, ref.channel),
        eq(schema.relayThreads.conversation, ref.conversation),
        eq(schema.relayThreads.thread, ref.thread),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * 스레드를 연다. 이미 있으면 그대로 돌려준다.
 *
 * 첫 요청자를 **덮어쓰지 않는다** — 되묻기의 답을 누구에게서 받을지가 이
 * 값으로 정해지므로, 나중에 끼어든 사람이 주인이 되면 안 된다.
 */
export async function openThread(args: {
  ref: ThreadRef;
  userId: string;
  starterExternalId: string;
}): Promise<ThreadRow> {
  const db = getDb();
  await db
    .insert(schema.relayThreads)
    .values({
      userId: args.userId,
      channel: args.ref.channel,
      conversation: args.ref.conversation,
      thread: args.ref.thread,
      starterExternalId: args.starterExternalId,
    })
    .onConflictDoNothing();
  const row = await findThread(args.ref);
  if (!row) throw new Error("스레드를 열지 못했다");
  return row;
}

export async function updateThread(
  id: string,
  patch: Partial<typeof schema.relayThreads.$inferInsert>,
): Promise<void> {
  if (!hasDb()) return;
  await getDb()
    .update(schema.relayThreads)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.relayThreads.id, id));
}

export async function recentThreads(userId: string, limit = 20) {
  if (!hasDb()) return [];
  return getDb()
    .select()
    .from(schema.relayThreads)
    .where(eq(schema.relayThreads.userId, userId))
    .orderBy(desc(schema.relayThreads.updatedAt))
    .limit(limit);
}

/**
 * 재시작으로 끊긴 실행을 표시한다.
 *
 * 실행 자체는 프로세스와 함께 사라졌다. 되살릴 수 없으므로 **죽었다는 사실만
 * 남긴다** — 조용히 사라지면 사용자는 아직 도는 줄 알고 기다린다.
 * 돌려준 행에 대해 부르는 쪽이 스레드에 한마디 쓴다.
 */
export async function markLostThreads(): Promise<ThreadRow[]> {
  if (!hasDb()) return [];
  return getDb()
    .update(schema.relayThreads)
    .set({ status: "lost", updatedAt: new Date() })
    .where(inArray(schema.relayThreads.status, ["queued", "running", "applying"]))
    .returning();
}

/** 만료된 코드와 오래된 멱등 키를 치운다. 무한히 쌓일 이유가 없다 */
export async function sweep(): Promise<void> {
  if (!hasDb()) return;
  const db = getDb();
  await db
    .delete(schema.relayLinkCodes)
    .where(sql`${schema.relayLinkCodes.createdAt} < now() - interval '1 day'`);
  await db
    .delete(schema.relayEvents)
    .where(sql`${schema.relayEvents.receivedAt} < now() - interval '2 days'`);
}
