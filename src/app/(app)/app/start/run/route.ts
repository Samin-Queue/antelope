import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";

import { MAX_FILE_BYTES } from "../_lib/fetch";
import type { IntakeInput } from "../_lib/intake";
import { runStart } from "../_lib/pipeline";
import type { StartEvent } from "../_lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * 1~5 단계. multipart 로 받아 SSE 로 흘린다.
 *
 * 유효성 검사·정보 분석 은 Studio job 이라 각각 수십 초가 걸린다. 결과만 한 번에 주면
 * 1~2분 동안 화면이 죽어 보인다.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "multipart/form-data 로 보내세요." }, { status: 400 });
  }

  const input: IntakeInput = {};
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: "파일이 25MB 를 넘습니다." }, { status: 413 });
    }
    input.file = file;
  }
  const url = String(form.get("url") ?? "").trim();
  if (url) {
    if (!/^https?:\/\//i.test(url)) {
      return Response.json({ error: "http(s) URL 을 입력하세요." }, { status: 400 });
    }
    input.url = url;
  }
  const text = String(form.get("text") ?? "").trim();
  if (text) input.text = text;

  if (!input.file && !input.url && !input.text) {
    return Response.json(
      { error: "파일, 링크, 문장 중 하나는 있어야 합니다." },
      { status: 400 },
    );
  }

  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;
  const userId = session?.user.id ?? null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StartEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* 클라이언트가 떠났다 */
        }
      };

      /**
       * 하트비트. SSE 주석이라 클라이언트 파서가 무시한다.
       *
       * Studio job 폴링은 최대 180초 동안 이벤트를 하나도 안 보낸다. 그 침묵을
       * 프록시가 idle 로 보고 끊으면 클라이언트는 `done` 도 못 받고 멈춘 채
       * 남는다 — 카드가 영원히 도는 「간헐적 무한로딩」의 다른 한 축이다.
       */
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* 닫혔다 */
        }
      }, 15_000);

      try {
        await runStart(input, emit, { userId });
      } catch (error) {
        emit({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        clearInterval(beat);
        try {
          controller.close();
        } catch {
          /* 이미 닫힘 */
        }
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
