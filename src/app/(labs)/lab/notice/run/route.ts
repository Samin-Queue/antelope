import { runPipeline, type RunEvent } from "../_lib/orchestrator";
import type { Notice } from "../_lib/schema";

export const maxDuration = 300;

/**
 * 파이프라인을 돌리며 진행 상황을 SSE 로 흘려보낸다.
 * 한 번에 결과만 주면 20~30초 동안 화면이 죽어 보인다.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    notice?: Notice;
    profile?: Record<string, string>;
    applyUrl?: string | null;
  };

  if (!body.notice) {
    return Response.json({ error: "notice 가 필요합니다." }, { status: 400 });
  }

  const notice = body.notice;
  const profile = body.profile ?? {};
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: RunEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await runPipeline(notice, profile, emit, { applyUrl: body.applyUrl });
      } catch (error) {
        emit({
          type: "agent:error",
          agent: "eligibility",
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
