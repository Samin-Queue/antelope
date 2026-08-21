import { llmInfo } from "@/lib/llm";
import { hasDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
    db: hasDb() ? "configured" : "missing",
    llm: llmInfo(),
  });
}
