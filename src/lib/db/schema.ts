import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
