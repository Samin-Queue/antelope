import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | undefined;

/**
 * DATABASE_URL 이 없는 동안에도 앱이 뜨도록 지연 초기화한다.
 * Railway Postgres 를 붙이기 전까지 랜딩/챗은 DB 없이 동작한다.
 */
export function getDb(): Db {
  if (cached) return cached;
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정 — Railway Postgres 를 먼저 연결하세요.");
  cached = drizzle(postgres(url, { prepare: false }), { schema });
  return cached;
}

export function hasDb(): boolean {
  return Boolean(env.DATABASE_URL);
}

export { schema };
