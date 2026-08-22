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
 * Samson·Michael 은 Studio job 이라 각각 수십 초가 걸린다. 결과만 한 번에 주면
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
      try {
        await runStart(input, emit, { userId });
      } catch (error) {
        emit({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
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
