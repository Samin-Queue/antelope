import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

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

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
