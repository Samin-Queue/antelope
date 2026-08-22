import { z } from "zod";

import { runBrowserAgent } from "@/app/(labs)/lab/notice/_lib/agent";
import { closeSession } from "@/app/(labs)/lab/notice/_lib/desktop";

import type { ApplyEvent } from "../_lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

const body = z.object({
  applyUrl: z.string().url(),
  title: z.string().min(1).max(200),
  facts: z.record(z.string(), z.string()),
});

/** 신청이 끝난 뒤 화면을 이만큼 더 남긴다. 접수 완료 화면을 사람이 봐야 한다 */
const LINGER_MS = 90_000;

/**
 * 9단계 — 자동 신청.
 *
 * 가상 데스크톱에 실제 Chromium 을 띄우고 화면만 보며 폼을 채운다.
 * 라이브 화면은 /lab/notice/live, 사람의 조작은 /lab/notice/control 이 받는다 —
 * 이 스트림은 진행 상황과 「사람이 필요하다」 신호만 흘린다.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "applyUrl·title·facts 가 필요합니다." },
      { status: 400 },
    );
  }
  const { applyUrl, title, facts } = parsed.data;
  const sessionId = `start-${Date.now()}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ApplyEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* 클라이언트가 떠났다 */
        }
      };
      emit({ type: "session", sessionId });
      try {
        const run = await runBrowserAgent({
          sessionId,
          startUrl: applyUrl,
          goal: `「${title}」 신청서를 작성하고 제출까지 완료하라. 회원가입·로그인이 필요하면 주어진 사실로 진행한다.`,
          facts,
          maxSteps: 40,
          allowSubmit: true,
          onStep: (entry) =>
            emit({
              type: "step",
              tool: entry.tool,
              detail: JSON.stringify(entry.input).slice(0, 160),
              title: entry.url ?? "",
            }),
          onFrame: (image, pageTitle) => emit({ type: "frame", image, title: pageTitle }),
          onNeedHuman: (reason) => emit({ type: "need:human", reason }),
          onHumanDone: () => emit({ type: "human:done" }),
        });
        emit({ type: "done", summary: run.summary, steps: run.steps });
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
        // Xvfb·Chromium 은 프로세스다. 안 닫으면 신청 한 번마다 하나씩 남는다.
        setTimeout(() => void closeSession(sessionId).catch(() => {}), LINGER_MS);
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
