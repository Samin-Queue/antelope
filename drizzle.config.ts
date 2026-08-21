import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js 는 .env.local 을 읽지만 dotenv 기본값은 .env 다. 둘 다 지원한다.
config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL 미설정 — .env.local 에 추가하거나 `pnpm docker:db` 로 로컬 DB 를 띄우세요.\n" +
      "  로컬 기본값: postgres://postgres:postgres@localhost:5432/antelope",
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
