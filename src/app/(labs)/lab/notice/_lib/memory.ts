import { and, asc, cosineDistance, desc, eq, inArray, lt, sql } from "drizzle-orm";

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

  /**
   * 같은 label 은 갱신한다 — 값이 바뀌었는데 옛것이 남아 있으면 잘못된 판정을
   * 만든다.
   *
   * **한 트랜잭션으로 묶는다.** 지우고 넣는 사이에 실패하면 사용자의 기존
   * 기억이 통째로 사라진다. 지식베이스가 이 제품의 해자인데 갱신 한 번이
   * 그걸 날릴 수 있으면 안 된다.
   */
  await db.transaction(async (tx) => {
    await tx.delete(schema.memories).where(
      and(
        eq(schema.memories.userId, userId),
        inArray(
          schema.memories.label,
          usable.map((entry) => entry.label.trim()),
        ),
      ),
    );

    await tx.insert(schema.memories).values(
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
  });

  return usable.length;
}

/**
 * 유사도 하한을 **코사인 거리 상한**으로 뒤집은 값.
 *
 * 의미는 글자 그대로 같다 — 거리 < 0.5 ⟺ 유사도 > 0.5. 형태만 바꾸는 이유는
 * pgvector HNSW 가 `ORDER BY col <=> $v ASC` 형태에만 붙기 때문이다.
 * `1 - (col <=> $v)` 를 `DESC` 로 정렬하면 인덱스가 **안 쓰인다** —
 * 실측(5,000행): seq scan 17.902ms → index scan 0.100ms.
 */
const DISTANCE_CEILING = 1 - SIMILARITY_FLOOR;

/** 이 공고가 묻는 항목들 중 이미 아는 것을 채워 돌려준다. */
export async function recallForFields(
  userId: string,
  labels: string[],
): Promise<Record<string, Memory>> {
  const wanted = labels.map((label) => label.trim()).filter(Boolean);
  if (wanted.length === 0) return {};

  const db = getDb();
  const found: Record<string, Memory> = {};

  // 1단계 — label 정확 일치.
  // ⚠ `select()` 로 전체 컬럼을 끌면 1024차원 벡터 **두 벌**이 행마다 딸려
  // 온다. 여기서 쓰는 것은 다섯 컬럼뿐이다.
  const exact = await db
    .select({
      id: schema.memories.id,
      kind: schema.memories.kind,
      label: schema.memories.label,
      value: schema.memories.value,
      sourceNotice: schema.memories.sourceNotice,
    })
    .from(schema.memories)
    .where(
      and(eq(schema.memories.userId, userId), inArray(schema.memories.label, wanted)),
    );

  for (const row of exact) found[row.label] = row;

  // 2단계 — 남은 항목은 임베딩으로 유사한 것을 찾는다
  const remaining = wanted.filter((label) => !found[label]);
  if (remaining.length === 0) return found;

  const vectors = await embed(remaining, "query");

  /**
   * 항목마다 왕복하지 않는다.
   *
   * 임베딩은 이미 배치인데 조회가 N+1 순차였다 — 항목 20개면 왕복 20번이고,
   * 그 하나하나가 인덱스를 못 타는 전체 스캔이었다. `UNION ALL` 로 한 번에
   * 보낸다. 서브쿼리마다 `LIMIT 1` 이라 각 항목의 최근접 하나씩만 온다.
   *
   * 배열 바인딩(`unnest($1::vector[])`)이 더 짧지만 drizzle + postgres.js 에서
   * 검증되지 않았다. 평범한 vector 스칼라 N개면 바인딩 위험이 0이고 인덱스도
   * 그대로 탄다.
   */
  const parts = remaining.map((_, index) => {
    const distance = cosineDistance(schema.memories.labelEmbedding, vectors[index]);
    return sql`(
      select ${sql.raw(String(index))}::int as ask,
             ${schema.memories.id} as id,
             ${schema.memories.kind} as kind,
             ${schema.memories.label} as label,
             ${schema.memories.value} as value,
             ${schema.memories.sourceNotice} as source_notice
        from ${schema.memories}
       where ${schema.memories.userId} = ${userId}
         and ${distance} < ${DISTANCE_CEILING}
       order by ${distance} asc
       limit 1
    )`;
  });

  const rows = await db.execute<{
    ask: number;
    id: string;
    kind: MemoryKind;
    label: string;
    value: string;
    source_notice: string | null;
  }>(sql.join(parts, sql` union all `));

  for (const row of rows) {
    const asked = remaining[Number(row.ask)];
    if (!asked) continue;
    found[asked] = {
      id: row.id,
      kind: row.kind,
      label: row.label,
      value: row.value,
      sourceNotice: row.source_notice,
    };
  }

  return found;
}

/**
 * 사업계획 작성에 쓸 서술형 기억. 배점 항목과 의미가 가까운 것을 꺼낸다.
 *
 * ⚠ **하한이 있어야 한다.** 없으면 무관한 기억도 상위 5개 안에 들어와 사업
 * 계획서의 근거로 실린다 — 지어내지 않는 것이 이 에이전트의 전부인데 엉뚱한
 * 사실을 근거로 대면 그게 더 나쁘다. 이 경로는 `writeDocument` 의 `userId`
 * 누락으로 여태 한 번도 안 돌았고, 그래서 이 결함이 드러난 적이 없다.
 *
 * 서술 검색은 항목 매칭보다 느슨해도 된다(0.35). 값을 자동으로 채우는 것이
 * 아니라 「참고하라」고 문단에 얹는 용도다.
 */
const NARRATIVE_CEILING = 1 - 0.35;

export async function recallNarratives(
  userId: string,
  query: string,
  limit = 5,
): Promise<Memory[]> {
  if (!query.trim()) return [];
  const db = getDb();
  const [vector] = await embed([query], "query");
  const distance = cosineDistance(schema.memories.embedding, vector);

  // 거리 오름차순이라야 HNSW 인덱스를 탄다. `1 - distance` 를 DESC 로 정렬하면
  // 플래너가 인덱스를 못 쓰고 전체를 훑는다(실측 §0.2).
  return db
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
        lt(distance, NARRATIVE_CEILING),
      ),
    )
    .orderBy(asc(distance))
    .limit(limit);
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
/**
 * 그물 계산은 O(n²)×1024 이고 **요청마다** 돈다. 지식이 늘수록 촘촘해지는 게
 * 이 화면의 요점이라 계산 자체는 남기되, 상한을 둔다 — 노드 200개면 비교
 * 19,900번 × 1024차원이고, 그때부터는 화면도 그물이 아니라 먹칠이다.
 */
const GRAPH_MAX_NODES = 200;
const GRAPH_MAX_EDGES = 2_000;

export async function graphEdges(userId: string, floor = 0.45): Promise<GraphEdge[]> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.memories.id, embedding: schema.memories.embedding })
    .from(schema.memories)
    .where(eq(schema.memories.userId, userId))
    .orderBy(desc(schema.memories.updatedAt))
    .limit(GRAPH_MAX_NODES);

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
  // 굵은 것부터 남긴다. 상한에 걸려 잘렸으면 조용히 자르지 않고 말한다 —
  // 「전부 그렸다」로 보이는 화면이 잘린 화면보다 나쁘다.
  edges.sort((a, b) => b.weight - a.weight);
  if (edges.length > GRAPH_MAX_EDGES) {
    console.log(`[graph] 간선 ${edges.length}개 중 굵은 ${GRAPH_MAX_EDGES}개만 그린다`);
    return edges.slice(0, GRAPH_MAX_EDGES);
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
