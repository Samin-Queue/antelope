import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// better-auth 테이블(user·session·account·verification). drizzleAdapter 가
// schema 객체에서 이 이름들을 찾는다.
export * from "./auth-schema";

/** Upstage solar-embedding-2-* 의 출력 차원. */
export const EMBEDDING_DIM = 1024;

/**
 * 트랙 확정 전까지의 최소 스키마.
 * 도메인 테이블은 8/21 20:00 이후 여기에 추가한다.
 */
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  sourceUrl: text("source_url"),
  /** Upstage Document Parse 등 파서 원본 출력 */
  raw: jsonb("raw"),
  /** 파서에서 추출한 평문 */
  content: text("content"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 검색이 필요해질 때 쓰는 청크 테이블. 지금은 비어 있어도 무해하다.
 * pgvector 는 로컬·프로덕션 모두 0.8.6 으로 활성화되어 있다
 * (`CREATE EXTENSION IF NOT EXISTS vector`).
 */
export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    /** 문서 내 순서 */
    ordinal: integer("ordinal").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // 코사인 거리 기준 HNSW. Upstage 임베딩은 정규화되어 있어 코사인이 맞다.
    index("document_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("document_chunks_document_idx").on(table.documentId),
  ],
);

export type ApplicationField = {
  readonly key: string;
  readonly label: string;
  readonly inputType: string;
  readonly required: boolean;
  readonly stage: string;
  readonly documentName: string;
  readonly formName: string;
  readonly instructions: string;
  readonly source: string;
};

export const applicationForms = pgTable(
  "application_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    applicationType: text("application_type").notNull(),
    title: text("title").notNull(),
    fields: jsonb("fields").$type<readonly ApplicationField[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("application_forms_document_idx").on(table.documentId)],
);

export const crawlRuns = pgTable("crawl_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const opportunityCards = pgTable(
  "opportunity_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlRunId: uuid("crawl_run_id").references(() => crawlRuns.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(),
    source: text("source").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    content: text("content").notNull(),
    screenshot: text("screenshot").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("opportunity_cards_category_idx").on(table.category, table.capturedAt),
  ],
);

/**
 * 기업 지식베이스 — 이 제품의 해자.
 *
 * 신청 한 번에 입력한 정보를 버리지 않는다. 사업자 정보 같은 사실뿐 아니라
 * 아이템 설명·강점·과거에 쓴 사업계획 문장까지 쌓아, 다음 공고에서 AI 가
 * 먼저 꺼내 쓴다. 쓸수록 벌어지므로 경쟁자가 따라오기 어렵다.
 */
export const memoryKind = pgEnum("memory_kind", [
  /** 변하지 않는 사실 — 생년월일, 사업자번호, 창업일 */
  "fact",
  /** 아이템·제품·기능 서술 */
  "item",
  /** 강점·실적·수상 */
  "strength",
  /** 과거에 실제로 쓴 사업계획서 문장 */
  "narrative",
]);

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 소유자. better-auth user.id 는 text 다 */
    userId: text("user_id").notNull(),
    kind: memoryKind("kind").notNull().default("fact"),
    /** 사람이 읽는 이름. fact 면 질문 항목명과 같다 (예: 생년월일) */
    label: text("label").notNull(),
    value: text("value").notNull(),
    /** 어느 공고에서 얻었는지 — 출처를 잃으면 신뢰할 수 없다 */
    sourceNotice: text("source_notice"),
    /**
     * 항목명만 임베딩한 벡터. 다음 공고가 다른 말로 물어도 찾기 위한 것이다.
     * 값을 섞으면 의미가 흐려진다 — "상시근로자 수 ↔ 현재 직원 수" 유사도가
     * 값 포함 0.526, 라벨만 0.578 로 실측됐다.
     */
    labelEmbedding: vector("label_embedding", { dimensions: EMBEDDING_DIM }),
    /** 내용까지 담은 벡터. 사업계획 작성에 쓸 서술을 꺼낼 때 쓴다 */
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    /** 같은 label 이 갱신되면 이전 것을 밀어낸다 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("memories_user_idx").on(table.userId),
    index("memories_user_label_idx").on(table.userId, table.label),
    index("memories_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("memories_label_embedding_idx").using(
      "hnsw",
      table.labelEmbedding.op("vector_cosine_ops"),
    ),
  ],
);

/** 목표 하나 = 세션 하나. 지난 목표 탭이 이걸 읽는다. */
export const goalStage = pgEnum("goal_stage", [
  "reviewing", // 검토 중 — 공고를 읽고 자격을 따지는 단계
  "working", // 작업 중 — 서류·신청서를 만드는 단계
  "waiting", // 결과 대기 중 — 제출하고 발표를 기다리는 단계
  "closed", // 종료됨
]);

export const goalOutcome = pgEnum("goal_outcome", [
  "won", // 선정
  "rejected", // 미선정
  "ineligible", // 자격 미달로 신청 못 함
  "deferred", // 나중에
  "abandoned", // 접음
]);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    organization: text("organization"),
    deadline: text("deadline"),
    stage: goalStage("stage").notNull().default("reviewing"),
    /** 아직 끝나지 않았으면 null */
    outcome: goalOutcome("outcome"),
    /** 정규화된 공고 객체와 파이프라인 결과 원본 */
    notice: jsonb("notice"),
    result: jsonb("result"),
    /**
     * 세션 스냅샷 — 요약·수집 파일·마스터 테이블.
     *
     * 이게 없으면 새로고침 한 번에 준비한 것이 전부 사라진다. 브라우저·파일
     * 에이전트가 읽는 **단일 진실**이라 값이 바뀔 때마다 여기를 갱신한다.
     * 모양은 `app/start/_lib/types.ts` 의 `SessionSnapshot`.
     */
    snapshot: jsonb("snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("goals_user_idx").on(table.userId, table.updatedAt)],
);

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
