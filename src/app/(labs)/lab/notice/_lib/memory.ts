import { and, cosineDistance, desc, eq, gt, inArray, sql } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { embed } from "@/lib/upstage";

/**
 * 기업 지식베이스.
 *
 * 신청 한 번에 입력한 정보를 버리지 않는다. 다음 공고에서 같은 걸 다시 묻지
 * 않는 것이 목적이고, 그게 쌓일수록 경쟁자와 벌어진다.
 *
 * 조회는 두 단계다. label 정확 일치를 먼저 보고(생년월일 → 생년월일),
 * 없으면 임베딩으로 유사한 것을 찾는다(상시근로자 수 → 현재 직원 수).
 */
export type MemoryKind = "fact" | "item" | "strength" | "narrative";

export type Memory = {
  id: string;
  kind: MemoryKind;
  label: string;
  value: string;
  sourceNotice: string | null;
};

/**
 * 항목명 유사도 하한.
 *
 * 실측: 정답쌍(상시근로자 수 ↔ 현재 직원 수) 0.578, 오답 최고 0.435.
 * 그 사이인 0.50 을 택했다. 올리면 못 찾고, 내리면 엉뚱한 값을 채운다.
 */
const SIMILARITY_FLOOR = 0.5;

export async function remember(
  userId: string,
  entries: Array<{
    kind?: MemoryKind;
    label: string;
    value: string;
    sourceNotice?: string;
  }>,
): Promise<number> {
  const usable = entries.filter((entry) => entry.label.trim() && entry.value.trim());
  if (usable.length === 0) return 0;

  const db = getDb();
  // 두 벌을 만든다 — 항목명만(다음 공고가 다른 말로 물을 때), 내용까지(서술 검색용).
  const [labelVectors, contentVectors] = await Promise.all([
    embed(
      usable.map((entry) => entry.label),
      "passage",
    ),
    embed(
      usable.map((entry) => `${entry.label}: ${entry.value}`),
      "passage",
    ),
  ]);

  // 같은 label 은 갱신한다 — 값이 바뀌었는데 옛것이 남아 있으면 잘못된 판정을 만든다.
  await db.delete(schema.memories).where(
    and(
      eq(schema.memories.userId, userId),
      inArray(
        schema.memories.label,
        usable.map((entry) => entry.label.trim()),
      ),
    ),
  );

  await db.insert(schema.memories).values(
    usable.map((entry, index) => ({
      userId,
      kind: entry.kind ?? "fact",
      label: entry.label.trim(),
      value: entry.value.trim(),
      sourceNotice: entry.sourceNotice ?? null,
      labelEmbedding: labelVectors[index],
      embedding: contentVectors[index],
    })),
  );

  return usable.length;
}

/** 이 공고가 묻는 항목들 중 이미 아는 것을 채워 돌려준다. */
export async function recallForFields(
  userId: string,
  labels: string[],
): Promise<Record<string, Memory>> {
  const wanted = labels.map((label) => label.trim()).filter(Boolean);
  if (wanted.length === 0) return {};

  const db = getDb();
  const found: Record<string, Memory> = {};

  // 1단계 — label 정확 일치
  const exact = await db
    .select()
    .from(schema.memories)
    .where(
      and(eq(schema.memories.userId, userId), inArray(schema.memories.label, wanted)),
    );

  for (const row of exact) {
    found[row.label] = {
      id: row.id,
      kind: row.kind,
      label: row.label,
      value: row.value,
      sourceNotice: row.sourceNotice,
    };
  }

  // 2단계 — 남은 항목은 임베딩으로 유사한 것을 찾는다
  const remaining = wanted.filter((label) => !found[label]);
  if (remaining.length === 0) return found;

  const vectors = await embed(remaining, "query");

  for (const [index, label] of remaining.entries()) {
    const similarity = sql<number>`1 - (${cosineDistance(schema.memories.labelEmbedding, vectors[index])})`;
    const [row] = await db
      .select({
        id: schema.memories.id,
        kind: schema.memories.kind,
        label: schema.memories.label,
        value: schema.memories.value,
        sourceNotice: schema.memories.sourceNotice,
        similarity,
      })
      .from(schema.memories)
      .where(and(eq(schema.memories.userId, userId), gt(similarity, SIMILARITY_FLOOR)))
      .orderBy(desc(similarity))
      .limit(1);

    if (row) {
      found[label] = {
        id: row.id,
        kind: row.kind,
        label: row.label,
        value: row.value,
        sourceNotice: row.sourceNotice,
      };
    }
  }

  return found;
}

/** 사업계획 작성에 쓸 서술형 기억. 배점 항목과 의미가 가까운 것을 꺼낸다. */
export async function recallNarratives(
  userId: string,
  query: string,
  limit = 5,
): Promise<Memory[]> {
  if (!query.trim()) return [];
  const db = getDb();
  const [vector] = await embed([query], "query");
  const similarity = sql<number>`1 - (${cosineDistance(schema.memories.embedding, vector)})`;

  const rows = await db
    .select({
      id: schema.memories.id,
      kind: schema.memories.kind,
      label: schema.memories.label,
      value: schema.memories.value,
      sourceNotice: schema.memories.sourceNotice,
    })
    .from(schema.memories)
    .where(
      and(
        eq(schema.memories.userId, userId),
        inArray(schema.memories.kind, ["item", "strength", "narrative"]),
      ),
    )
    .orderBy(desc(similarity))
    .limit(limit);

  return rows;
}

/** 지식 목록. 그래프와 편집 화면이 함께 쓴다. */
export async function listMemories(userId: string): Promise<Memory[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.memories.id,
      kind: schema.memories.kind,
      label: schema.memories.label,
      value: schema.memories.value,
      sourceNotice: schema.memories.sourceNotice,
    })
    .from(schema.memories)
    .where(eq(schema.memories.userId, userId))
    .orderBy(desc(schema.memories.updatedAt));
  return rows;
}

export type GraphEdge = { source: string; target: string; weight: number };

/**
 * 지식 사이의 연결.
 *
 * 꾸며낸 선이 아니라 저장된 벡터의 실제 코사인 유사도다. 항목명 벡터를 쓰면
 * "현재 직원 수 ↔ 상시근로자 수" 같은 동의 관계가, 내용 벡터를 쓰면 주제
 * 근접성이 잡힌다. 화면에서는 후자가 더 그물처럼 보인다.
 */
export async function graphEdges(userId: string, floor = 0.45): Promise<GraphEdge[]> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.memories.id, embedding: schema.memories.embedding })
    .from(schema.memories)
    .where(eq(schema.memories.userId, userId));

  const nodes = rows.filter((row) => row.embedding) as Array<{
    id: string;
    embedding: number[];
  }>;

  const cosine = (a: number[], b: number[]) => {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  };

  const edges: GraphEdge[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const weight = cosine(nodes[i].embedding, nodes[j].embedding);
      if (weight >= floor) {
        edges.push({ source: nodes[i].id, target: nodes[j].id, weight });
      }
    }
  }
  return edges;
}

export async function updateMemory(
  userId: string,
  id: string,
  patch: { label?: string; value?: string; kind?: MemoryKind },
): Promise<void> {
  const db = getDb();
  const [current] = await db
    .select()
    .from(schema.memories)
    .where(and(eq(schema.memories.userId, userId), eq(schema.memories.id, id)));
  if (!current) return;

  const label = patch.label?.trim() || current.label;
  const value = patch.value?.trim() || current.value;
  const [labelVector, contentVector] = await Promise.all([
    embed([label], "passage"),
    embed([`${label}: ${value}`], "passage"),
  ]);

  await db
    .update(schema.memories)
    .set({
      label,
      value,
      kind: patch.kind ?? current.kind,
      labelEmbedding: labelVector[0],
      embedding: contentVector[0],
      updatedAt: new Date(),
    })
    .where(and(eq(schema.memories.userId, userId), eq(schema.memories.id, id)));
}

export async function forgetMemory(userId: string, id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(schema.memories)
    .where(and(eq(schema.memories.userId, userId), eq(schema.memories.id, id)));
}
