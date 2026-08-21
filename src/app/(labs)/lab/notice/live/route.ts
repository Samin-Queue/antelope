import { subscribeLive } from "../_lib/desktop";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * 라이브 뷰 — 가상 데스크톱 화면을 SSE 로 흘린다.
 *
 * GET 이라 EventSource 로 붙는다. 세션이 아직 없으면(브라우저 에이전트가 2단계에서
 * 뜬다) 생길 때까지 기다렸다가 시작한다. 화면이 바뀐 프레임만 온다.
 */
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("session");
  if (!sessionId) {
    return Response.json({ error: "session 이 필요합니다." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          /* 닫힌 스트림 */
        }
      };
      send("status", JSON.stringify({ waiting: true }));
      try {
        unsubscribe = await subscribeLive(sessionId, (jpeg) => {
          send("frame", jpeg.toString("base64"));
        });
        send("status", JSON.stringify({ waiting: false }));
      } catch (error) {
        send("error", error instanceof Error ? error.message : String(error));
        controller.close();
      }
    },
    cancel() {
      unsubscribe?.();
    },
  });

  req.signal.addEventListener("abort", () => unsubscribe?.());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
