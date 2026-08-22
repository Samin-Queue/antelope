import { z } from "zod";

import { runBrowserAgent } from "@/app/(labs)/lab/notice/_lib/agent";
import { closeSession } from "@/app/(labs)/lab/notice/_lib/desktop";
import {
  probeCaptcha,
  runPlaywrightAgent,
} from "@/app/(labs)/lab/notice/_lib/playwright-agent";

import type { ApplyEvent } from "../_lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

const body = z.object({
  applyUrl: z.string().url(),
  title: z.string().min(1).max(200),
  facts: z.record(z.string(), z.string()),
  /**
   * 계획 에이전트가 세운 순서를 문자열로 옮긴 것.
   * `human` 은 브라우저가 손대면 안 되는 일 — 이게 없으면 증명서 발급 화면
   * 앞에서 붙잡혀 스텝을 태운다.
   */
  plan: z
    .object({
      browser: z.array(z.string().max(300)).max(8).optional(),
      human: z.array(z.string().max(300)).max(8).optional(),
    })
    .optional(),
});

/** 신청이 끝난 뒤 화면을 이만큼 더 남긴다. 접수 완료 화면을 사람이 봐야 한다 */
const LINGER_MS = 90_000;

/**
 * 9단계 — 자동 신청. 브라우저가 두 갈래다.
 *
 *   캡챠 없음 → **Playwright**. DOM 을 직접 읽으니 라벨·현재값·선택지가 정확히
 *               오고, 날짜·라디오·드롭다운이 한 번에 들어간다. 화면 캡처만 흘린다.
 *   캡챠 있음 → **Xvfb + xdotool**. 화면으로만 읽어 느리지만, X 서버로 직접
 *               들어가므로 캡챠 iframe 안도 사람이 그대로 조작할 수 있다.
 *
 * 시작 전에 한 번 보고 고르고, 자동으로 돌다 중간에 캡챠가 뜨면 그 자리에서
 * 수동으로 갈아탄다 — 캡챠는 제출을 누른 뒤에 나타나는 경우가 많다.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "applyUrl·title·facts 가 필요합니다." },
      { status: 400 },
    );
  }
  const { applyUrl, title, facts, plan } = parsed.data;
  const sessionId = `start-${Date.now()}`;
  const goal = `「${title}」 신청서를 작성하고 제출까지 완료하라. 회원가입·로그인이 필요하면 주어진 사실로 진행한다.`;

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
      const step = (entry: { tool: string; input: unknown; url?: string }) =>
        emit({
          type: "step",
          tool: entry.tool,
          detail: JSON.stringify(entry.input).slice(0, 160),
          title: entry.url ?? "",
        });

      let usedDesktop = false;
      try {
        const probe = await probeCaptcha(applyUrl);

        if (!probe.found) {
          emit({
            type: "mode",
            mode: "auto",
            reason: "캡챠가 보이지 않아 자동으로 채운다",
          });
          const run = await runPlaywrightAgent({
            startUrl: applyUrl,
            goal,
            facts,
            maxSteps: 60,
            allowSubmit: true,
            onStep: step,
            onFrame: (image, url) => emit({ type: "frame", image, title: url }),
          });

          if (!run.captcha) {
            emit({ type: "done", summary: run.summary, steps: run.steps });
            return;
          }
          // 자동으로 가다 캡챠를 만났다. 사람이 풀 수 있는 쪽으로 갈아탄다.
          emit({
            type: "mode",
            mode: "manual",
            reason: `진행 중 캡챠가 나타났다 (${run.captcha.reason}). 직접 조작으로 넘긴다`,
          });
        } else {
          emit({
            type: "mode",
            mode: "manual",
            reason: `캡챠가 있다 (${probe.reason}). 직접 조작할 수 있는 브라우저로 연다`,
          });
        }

        usedDesktop = true;
        emit({ type: "session", sessionId });
        const run = await runBrowserAgent({
          sessionId,
          startUrl: applyUrl,
          goal,
          facts,
          plan,
          maxSteps: 60,
          allowSubmit: true,
          onStep: step,
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
        // 자동 모드로만 끝났으면 띄운 적이 없으니 건드릴 것도 없다.
        if (usedDesktop) {
          setTimeout(() => void closeSession(sessionId).catch(() => {}), LINGER_MS);
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
