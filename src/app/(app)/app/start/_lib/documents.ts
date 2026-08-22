import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb, hasDb, schema } from "@/lib/db";

/**
 * 재사용 서류 보관함.
 *
 * 발급 서류는 공고마다 같은 것을 낸다. 한 번 올린 것을 다시 달라고 하면
 * 이 제품이 파는 「다시 묻지 않는다」가 값에만 해당하는 셈이 된다.
 *
 * 조회는 이름으로 한다. 「사업자등록증」·「사업자등록증 사본」·「사업자등록증
 * 사본 1부」는 같은 서류다 — 임베딩까지 가지 않고 접미어를 털어 맞춘다.
 * 항목명 임베딩은 값이 짧은 fact 에는 잘 듣지만, 서류 이름은 표기 변주가
 * 몇 가지로 정해져 있어 규칙으로 충분하다.
 */
const NOISE =
  /(사본|원본|파일|첨부|제출|서류|증빙|각\s*\d+부|\d+부|스캔본?|양식|서식|１부)/g;

export function documentKey(label: string): string {
  return label
    .toLowerCase()
    .replace(NOISE, "")
    .replace(/[\s\-_·.,:()（）*※\[\]]/g, "")
    .trim();
}

export type StoredDocument = {
  id: string;
  label: string;
  filename: string;
  mime: string;
  bytes: number;
  sourceNotice: string | null;
  updatedAt: Date;
};

/** 요청한 이름들 중 이미 가진 것. 키는 넘긴 라벨 그대로 돌려준다. */
export async function recallDocuments(
  userId: string,
  labels: string[],
): Promise<Record<string, StoredDocument>> {
  if (!hasDb() || labels.length === 0) return {};
  const keys = [...new Set(labels.map(documentKey))].filter(Boolean);
  if (keys.length === 0) return {};

  const rows = await getDb()
    .select({
      id: schema.userDocuments.id,
      label: schema.userDocuments.label,
      matchKey: schema.userDocuments.matchKey,
      filename: schema.userDocuments.filename,
      mime: schema.userDocuments.mime,
      bytes: schema.userDocuments.bytes,
      sourceNotice: schema.userDocuments.sourceNotice,
      updatedAt: schema.userDocuments.updatedAt,
    })
    .from(schema.userDocuments)
    .where(
      and(
        eq(schema.userDocuments.userId, userId),
        inArray(schema.userDocuments.matchKey, keys),
      ),
    )
    .orderBy(desc(schema.userDocuments.updatedAt));

  const byKey = new Map<string, StoredDocument>();
  for (const row of rows) if (!byKey.has(row.matchKey)) byKey.set(row.matchKey, row);

  const out: Record<string, StoredDocument> = {};
  for (const label of labels) {
    const found = byKey.get(documentKey(label));
    if (found) out[label] = found;
  }
  return out;
}

/** 바이트까지 꺼낸다. 브라우저가 첨부할 때만 쓴다 — 목록 조회에는 싣지 않는다. */
export async function documentBytes(
  userId: string,
  id: string,
): Promise<{ filename: string; mime: string; data: Buffer } | null> {
  if (!hasDb()) return null;
  const [row] = await getDb()
    .select({
      filename: schema.userDocuments.filename,
      mime: schema.userDocuments.mime,
      data: schema.userDocuments.data,
    })
    .from(schema.userDocuments)
    .where(and(eq(schema.userDocuments.id, id), eq(schema.userDocuments.userId, userId)))
    .limit(1);
  return row ? { ...row, data: Buffer.from(row.data, "base64") } : null;
}

/**
 * 올린 서류를 보관한다. 같은 이름이 이미 있으면 갈아끼운다 —
 * 서류는 새로 발급받은 쪽이 항상 맞다.
 */
export async function rememberDocument(
  userId: string,
  input: {
    label: string;
    filename: string;
    mime: string;
    data: Buffer;
    sourceNotice?: string | null;
  },
): Promise<StoredDocument | null> {
  if (!hasDb()) return null;
  const db = getDb();
  const matchKey = documentKey(input.label);
  if (!matchKey) return null;

  const values = {
    userId,
    label: input.label,
    matchKey,
    filename: input.filename,
    mime: input.mime,
    bytes: input.data.length,
    data: input.data.toString("base64"),
    sourceNotice: input.sourceNotice ?? null,
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: schema.userDocuments.id })
    .from(schema.userDocuments)
    .where(
      and(
        eq(schema.userDocuments.userId, userId),
        eq(schema.userDocuments.matchKey, matchKey),
      ),
    )
    .limit(1);

  const [row] = existing
    ? await db
        .update(schema.userDocuments)
        .set(values)
        .where(eq(schema.userDocuments.id, existing.id))
        .returning()
    : await db.insert(schema.userDocuments).values(values).returning();

  return row
    ? {
        id: row.id,
        label: row.label,
        filename: row.filename,
        mime: row.mime,
        bytes: row.bytes,
        sourceNotice: row.sourceNotice,
        updatedAt: row.updatedAt,
      }
    : null;
}

/** 데이터 허브에 늘어놓을 목록. 바이트는 싣지 않는다. */
export async function listDocuments(userId: string): Promise<StoredDocument[]> {
  if (!hasDb()) return [];
  return getDb()
    .select({
      id: schema.userDocuments.id,
      label: schema.userDocuments.label,
      filename: schema.userDocuments.filename,
      mime: schema.userDocuments.mime,
      bytes: schema.userDocuments.bytes,
      sourceNotice: schema.userDocuments.sourceNotice,
      updatedAt: schema.userDocuments.updatedAt,
    })
    .from(schema.userDocuments)
    .where(eq(schema.userDocuments.userId, userId))
    .orderBy(desc(schema.userDocuments.updatedAt));
}
