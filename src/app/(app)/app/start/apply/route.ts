import { z } from "zod";

import { runBrowserAgent } from "@/app/(labs)/lab/notice/_lib/agent";
import { closeSession } from "@/app/(labs)/lab/notice/_lib/desktop";
import {
  probeCaptcha,
  runPlaywrightAgent,
} from "@/app/(labs)/lab/notice/_lib/playwright-agent";

import { artifactDir, writeDocument } from "../_lib/file-agent";
import { narrate, type NarrationTurn } from "../_lib/narrator";
import { makePlan } from "../_lib/plan";
import { ask, closeRun, openRun } from "../_lib/run-registry";
import type { AgentKey, ApplyEvent, CardKey, Need, Plan } from "../_lib/types";

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
  /**
   * 파일 에이전트가 만들어 둔 파일. `path` 는 컨테이너 안 경로라 같은
   * 인스턴스에서만 유효하다 — 없으면 업로드 칸을 건너뛴다.
   */
  artifacts: z
    .array(
      z.object({
        label: z.string().max(120),
        filename: z.string().max(200),
        path: z.string().max(500),
      }),
    )
    .max(12)
    .optional(),
  /** 사용자가 이 실행에 개입할 때 쓰는 id. 클라이언트가 만들어 보낸다 */
  runId: z.string().min(8).max(64),
  /** 되부르기에 필요한 재료 — 마스터 테이블과 준비 문서 */
  needs: z.array(z.record(z.string(), z.unknown())).max(200).optional(),
  brief: z.string().max(40_000).optional(),
  organization: z.string().max(200).nullish(),
  deadline: z.string().max(40).nullish(),
  /**
   * 준비 단계에서 서술자가 이미 한 말. 스트림이 둘로 갈려 있어서 클라이언트를
   * 거쳐 넘긴다 — 이게 없으면 신청 단계 서술이 매번 처음부터 다시 설명한다.
   */
  narration: z
    .array(
      z.object({
        card: z.string().max(20),
        headline: z.string().max(200),
        body: z.string().max(2000),
      }),
    )
    .max(20)
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
  const { applyUrl, title, facts, plan, runId, brief, organization, deadline } =
    parsed.data;
  const history = (parsed.data.narration ?? []) as NarrationTurn[];
  const artifacts = [...(parsed.data.artifacts ?? [])];
  const needs = (parsed.data.needs ?? []) as unknown as Need[];
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

      /** 되부른 에이전트의 카드를 켰다 끈다. 브라우저 카드와 함께 켜진다 */
      const lit = async <T>(agent: AgentKey, detail: string, task: () => Promise<T>) => {
        emit({ type: "agent", agent, status: "start", detail });
        try {
          const value = await task();
          emit({ type: "agent", agent, status: "done" });
          return value;
        } catch (error) {
          emit({
            type: "agent",
            agent,
            status: "error",
            detail: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      };

      /**
       * 준비 단계와 **같은 서술자**가 이어서 쓴다. 그래서 「계획에서 사람이
       * 해야 한다고 표시한 두 가지를 빼고 나머지를 넣는다」 같은 말이 나온다.
       */
      const tell = async (card: CardKey, factText: string, reason?: string) => {
        const said = await narrate(
          { card, facts: factText, history, reason },
          { log: (text) => emit({ type: "step", tool: "say", detail: text, title: "" }) },
        );
        if (!said) return;
        history.push({ card, ...said });
        emit({ type: "card", card, headline: said.headline, body: said.body });
      };

      openRun(runId);
      emit({ type: "agent", agent: "browser", status: "start" });

      /**
       * 브라우저가 막혔을 때 되부르는 통로.
       *
       * 이 셋이 티키타카의 전부다 — 사람에게 떠넘기는 대신 값을 받아 오고,
       * 서류를 만들어 오고, 계획을 다시 짠다. 각각 카드가 켜지므로 화면에
       * 브라우저 → 데이터/파일/계획 → 브라우저 왕복이 그대로 보인다.
       */
      const helpers = {
        async askUser({ label, why }: { label: string; why: string }) {
          const id = `${runId}-${Date.now()}`;
          emit({ type: "agent", agent: "prefill", status: "start", detail: label });
          emit({ type: "ask", id, label, why, kind: "text" });
          const value = await ask(runId, { id, label });
          emit({ type: "answered", id, label });
          emit({ type: "agent", agent: "prefill", status: "done" });
          void tell(
            "data",
            `신청 폼에 「${label}」 칸이 있는데 준비 단계에서 채우지 못했다. 사용자에게 물어 값을 받았다.`,
            why,
          );
          return value;
        },

        async makeFile({ label, format }: { label: string; format: string }) {
          const made = await lit("documents", label, () =>
            writeDocument(
              {
                needKey: `browser-${label}`,
                label,
                title: label,
                sections: [],
                format: (["pdf", "hwp", "hwpx", "docx", "xlsx"] as const).includes(
                  format as never,
                )
                  ? (format as "pdf")
                  : "pdf",
              },
              { title, organization: organization ?? null, brief: brief ?? "", needs },
              artifactDir(runId),
              {
                log: (text) =>
                  emit({ type: "step", tool: "file", detail: text, title: "" }),
              },
            ),
          );
          if (!made) return null;
          void tell(
            "file",
            `신청 폼이 「${label}」 파일을 요구해 그 자리에서 만들었다. 파일명 ${made.artifact.filename}, 형식 ${format}.`,
            "신청 도중 없던 첨부 파일이 필요해졌다",
          );
          artifacts.push({
            label,
            filename: made.artifact.filename,
            path: made.artifact.path,
          });
          return { filename: made.artifact.filename, path: made.artifact.path };
        },

        async replan({ problem }: { problem: string }) {
          const revised = await lit("plan", problem, () =>
            makePlan(
              {
                title,
                organization: organization ?? null,
                deadline: deadline ?? null,
                applyUrl,
                brief: brief ?? null,
                summary: `신청 도중 막혔다: ${problem}`,
                needs,
                today: new Date().toISOString().slice(0, 10),
              },
              {
                log: (text) =>
                  emit({ type: "step", tool: "plan", detail: text, title: "" }),
              },
            ),
          );
          if (revised) {
            void tell(
              "plan",
              `신청 도중 막혀 계획을 다시 세웠다. 새 순서: ${revised.steps.map((step) => step.title).join(" → ")}`,
              problem,
            );
          }
          return revised ? summarizePlan(revised) : null;
        },
      };

      let usedDesktop = false;
      try {
        await tell(
          "browser",
          `신청 페이지 ${applyUrl} 를 연다. 채울 값 ${Object.keys(facts).length}개, 첨부할 파일 ${artifacts.length}개를 들고 간다.` +
            (plan?.human?.length
              ? ` 계획에서 사람이 해야 한다고 표시한 것: ${plan.human.join(", ")} — 브라우저는 건드리지 않는다.`
              : ""),
        );

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
            plan,
            artifacts,
            helpers,
            maxSteps: 60,
            allowSubmit: true,
            onStep: step,
            onFrame: (image, url) => emit({ type: "frame", image, title: url }),
          });

          if (!run.captcha) {
            await tell(
              "browser",
              `신청을 마쳤다. ${run.steps}번 조작했다. ${run.summary}`,
            );
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
        await tell(
          "browser",
          `직접 조작 모드로 신청을 마쳤다. ${run.steps}번 조작했다. ${run.summary}`,
        );
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
        emit({ type: "agent", agent: "browser", status: "done" });
        closeRun(runId);
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

/** 새 계획을 브라우저가 읽을 몇 줄로 줄인다. 전문을 넘기면 프롬프트가 넘친다 */
function summarizePlan(plan: Plan): string {
  return plan.steps
    .filter((step) => step.owner === "browser")
    .map((step, index) => `${index + 1}. ${step.title}`)
    .join("\n");
}
