import { hasDb } from "@/lib/db";
import { llmInfo } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
    db: hasDb() ? "configured" : "missing",
    llm: llmInfo(),
  });
}
