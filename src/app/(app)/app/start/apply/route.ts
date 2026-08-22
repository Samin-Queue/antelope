import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { guardProcess } from "@/lib/guard";
import { NeedsHuman, runBrowserAgent } from "@/app/(labs)/lab/notice/_lib/agent";
import { closeSession } from "@/app/(labs)/lab/notice/_lib/desktop";
import {
  probeCaptcha,
  runPlaywrightAgent,
} from "@/app/(labs)/lab/notice/_lib/playwright-agent";
import type { TraceEntry } from "@/app/(labs)/lab/notice/_lib/types";

import { artifactDir, artifactPath, writeDocument } from "../_lib/file-agent";
import { narrate, type NarrationTurn } from "../_lib/narrator";
import { makePlan } from "../_lib/plan";
import { ask, closeRun, openRun, takeSteer } from "../_lib/run-registry";
import { saveApplyResult } from "../_lib/session";
import type { AgentKey, ApplyEvent, CardKey, Need, Plan } from "../_lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

/**
 * 길면 **자른다**. 거절하지 않는다.
 *
 * 스키마가 열 몇 개 필드를 전부 똑같이 엄격하게 받고 있었다. 준비 문서가 길거나
 * 제목이 긴 것처럼 신청 자체와 무관한 이유로 400 이 나고, 화면에는 「applyUrl·
 * title·facts 가 필요합니다」만 떠서 원인을 좁힐 수도 없었다.
 *
 * 요청이 없으면 못 도는 것(`applyUrl`·`facts`·`runId`)만 거절할 수 있고,
 * 나머지 맥락은 잘라서 받는다.
 *
 * ⚠ 맥락 필드는 전부 `.nullish()` 다. `.optional()` 은 undefined 만 받는데
 *   클라이언트 상태가 `string | null` 이라 `null` 이 그대로 실려 온다 —
 *   실제로 `brief: null` 하나 때문에 신청이 400 으로 죽었다.
 */
const clamped = (max: number) => z.string().transform((text) => text.slice(0, max));

const body = z.object({
  /**
   * 사람이 직접 칠 수 있는 값이라 여기서는 「비어 있지 않다」만 본다.
   * 스킴 누락 같은 건 `normalizeUrl` 이 손보고, 그래도 안 되면 입력값을
   * 그대로 보여 주며 거절한다 — `.url()` 로 여기서 튕기면 무엇이 틀렸는지
   * 알 수 없다.
   */
  applyUrl: z.string().min(1),
  title: clamped(200).nullish(),
  facts: z.record(z.string(), z.string()),
  /**
   * 계획 에이전트가 세운 순서를 문자열로 옮긴 것.
   * `human` 은 브라우저가 손대면 안 되는 일 — 이게 없으면 증명서 발급 화면
   * 앞에서 붙잡혀 스텝을 태운다.
   */
  plan: z
    .object({
      browser: z
        .array(clamped(300))
        .nullish()
        .transform((list) => list?.slice(0, 8)),
      human: z
        .array(clamped(300))
        .nullish()
        .transform((list) => list?.slice(0, 8)),
    })
    .nullish(),
  /**
   * 파일 에이전트가 만들어 둔 파일.
   *
   * ⚠ **`path` 를 받지 않는다.** 받던 시절에는 클라이언트가 정한 임의
   * 파일시스템 경로가 검증 없이 `setInputFiles` 로 들어가, 로그인한 사용자
   * 한 명이 컨테이너의 아무 파일이나 자기 서버(`applyUrl` 도 이 요청이 정한다)
   * 로 올릴 수 있었다. 이름만 받고 경로는 서버가 `artifactDir(runId)` 안에서
   * 복원한다 — 그 밖은 애초에 만들어지지 않는다.
   */
  artifacts: z
    .array(
      z.object({
        label: clamped(120),
        filename: clamped(200),
      }),
    )
    .nullish()
    .transform((list) => list?.slice(0, 12) ?? undefined),
  /** 사용자가 이 실행에 개입할 때 쓰는 id. 클라이언트가 만들어 보낸다 */
  runId: z.string().min(8).max(64),
  /**
   * 이 신청이 속한 세션(`goals.id`). 결과를 여기에 남긴다.
   *
   * 없으면 기록만 건너뛰고 신청은 그대로 돈다 — 로그인 전이거나 DB 가 없는
   * 환경에서도 데모가 돌아야 한다.
   */
  sessionId: z.string().uuid().nullish(),
  /** 되부르기에 필요한 재료 — 마스터 테이블과 준비 문서 */
  needs: z
    .array(z.record(z.string(), z.unknown()))
    .nullish()
    .transform((list) => list?.slice(0, 200) ?? undefined),
  brief: clamped(40_000).nullish(),
  organization: clamped(200).nullish(),
  deadline: clamped(40).nullish(),
  /**
   * 준비 단계에서 서술자가 이미 한 말. 스트림이 둘로 갈려 있어서 클라이언트를
   * 거쳐 넘긴다 — 이게 없으면 신청 단계 서술이 매번 처음부터 다시 설명한다.
   */
  narration: z
    .array(
      z.object({
        card: clamped(20),
        headline: clamped(200),
        body: clamped(2000),
      }),
    )
    .nullish()
    .transform((list) => list?.slice(-20) ?? undefined),
});

/**
 * 사람이 친 주소를 받아 준다.
 *
 * 스킴 없이 `www.k-startup.go.kr/...` 로 치는 것이 흔한데, `z.string().url()` 은
 * 그 자리에서 튕긴다. 붙여 보고 다시 판정한다. http(s) 가 아니면 거절한다 —
 * `javascript:` 같은 것을 브라우저에 넘길 수는 없다.
 */
function normalizeUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    try {
      const url = new URL(text);
      return url.protocol === "http:" || url.protocol === "https:"
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  // 스킴이 없다. 붙여 보되 **호스트가 도메인처럼 생겼을 때만** 받는다.
  // 아무 글자에나 붙이면 한글 문장도 IDN 호스트로 성립한다 — 실측에서
  // 「채워야함」 이 https://xn--2f5b1x83jr1k/ 가 되어 브라우저가 거기로 갔다.
  // 퓨니코드로 바뀐 한 덩어리에는 점이 없으므로 이 검사에서 걸린다.
  try {
    const url = new URL(`https://${text}`);
    if (!/^[^\s.]+(\.[^\s.]+)*\.[a-z]{2,}$/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

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
  // 떠 있는 프로미스 하나가 서버 전체를 내리지 않게. `src/lib/guard.ts` 참고
  guardProcess();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // 어느 필드가 왜 걸렸는지 말한다. 「applyUrl·title·facts 가 필요합니다」만
    // 띄우면 실제 원인이 다른 필드일 때 엉뚱한 데를 뒤지게 된다.
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "요청";
    return Response.json(
      { error: `요청이 올바르지 않습니다 — ${where}: ${issue?.message ?? "형식 오류"}` },
      { status: 400 },
    );
  }
  const applyUrl = normalizeUrl(parsed.data.applyUrl);
  if (!applyUrl) {
    return Response.json(
      {
        error: `신청 URL 이 올바르지 않습니다: ${parsed.data.applyUrl.slice(0, 120)}`,
      },
      { status: 400 },
    );
  }
  const { facts, runId, brief, organization, deadline } = parsed.data;
  const plan = parsed.data.plan ?? undefined;
  const title = parsed.data.title?.trim() || "제목 미상";
  const history = (parsed.data.narration ?? []) as NarrationTurn[];
  const needs = (parsed.data.needs ?? []) as unknown as Need[];
  /** Xvfb 데스크톱 세션 id. `goals.id` 인 `parsed.data.sessionId` 와 다른 것이다 */
  const desktopId = `start-${Date.now()}`;
  const goalId = parsed.data.sessionId ?? null;

  /**
   * 파일 경로는 **서버가 만든다.** 이름만 받아 이번 실행의 디렉터리 안에서
   * 되짚고, 실제로 있는 것만 남긴다. 없는 이름은 조용히 빠지고 브라우저는
   * 그 칸을 「사람이 올려야 한다」로 보고한다 — 그 동작은 예전과 같다.
   */
  let runDir: string;
  try {
    runDir = artifactDir(runId);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "runId 가 올바르지 않습니다." },
      { status: 400 },
    );
  }
  const artifacts: Array<{ label: string; filename: string; path: string }> = [];
  for (const item of parsed.data.artifacts ?? []) {
    try {
      const path = artifactPath(runDir, item.filename);
      if (existsSync(path)) artifacts.push({ ...item, path });
    } catch {
      /* 경로로 성립하지 않는 이름은 버린다 */
    }
  }
  const goal = `「${title}」 신청서를 작성하고 제출까지 완료하라. 회원가입·로그인이 필요하면 주어진 사실로 진행한다.`;

  /**
   * 누구의 신청인가.
   *
   * 결과를 `goals` 에 남기려면 필요하고, `runId` 소유권 검사에도 쓴다.
   * 이 라우트는 프록시가 인증을 강제하는 `/app/*` 아래에 있지만, **어느
   * 사용자인지**는 여기서 직접 봐야 안다.
   */
  const authed = hasDb() ? await auth.api.getSession({ headers: await headers() }) : null;
  const userId = authed?.user.id ?? null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      /** `done`·`error` 를 한 번은 보냈는가. 안 보내고 닫으면 화면이 이유를 모른다 */
      let closed = false;
      const emit = (event: ApplyEvent) => {
        if (event.type === "done" || event.type === "error") closed = true;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* 클라이언트가 떠났다 */
        }
      };
      /**
       * 하트비트. SSE 주석이라 클라이언트 파서가 무시한다.
       * 브라우저가 한 스텝에 오래 매달리면 그동안 이벤트가 안 나가는데,
       * 그 침묵을 프록시가 idle 로 보고 끊으면 화면이 멈춘 채 남는다.
       */
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* 닫혔다 */
        }
      }, 15_000);

      /**
       * 조작 하나하나. 화면으로 흘리고 **동시에 붙잡아 둔다**.
       *
       * 사용자 명의로 실제 접수를 하면서 무엇을 눌렀는지 아무 데도 남기지
       * 않으면, 「엉뚱한 값이 들어갔다」는 신고를 재구성할 방법이 없다.
       */
      const trace: TraceEntry[] = [];
      const step = (entry: TraceEntry) => {
        trace.push(entry);
        emit({
          type: "step",
          tool: entry.tool,
          detail: JSON.stringify(entry.input).slice(0, 160),
          title: entry.url ?? "",
        });
      };

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
        emit({ type: "orchestrator", status: "start" });
        try {
          const said = await narrate(
            { card, facts: factText, history, reason },
            {
              log: (text) => emit({ type: "step", tool: "say", detail: text, title: "" }),
            },
          );
          if (!said) return;
          history.push({ card, ...said });
          emit({ type: "card", card, headline: said.headline, body: said.body });
        } finally {
          emit({ type: "orchestrator", status: "done" });
        }
      };

      openRun(runId, userId);
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
              {
                title,
                organization: organization ?? null,
                brief: brief ?? "",
                needs,
                // 서술형 기억을 꺼내는 유일한 열쇠. 없으면 그 벡터가 안 쓰인다.
                userId,
              },
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
      /** 무엇으로 끝났는가. `finally` 가 이걸 그대로 DB 에 쓴다 */
      let outcome: {
        summary: string | null;
        steps: number;
        mode: "auto" | "manual" | null;
        error?: string;
      } = { summary: null, steps: 0, mode: null, error: "신청이 끝나지 않았다." };
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
            steer: () => takeSteer(runId),
            onStep: step,
            onFrame: (image, url) => emit({ type: "frame", image, title: url }),
          });

          if (!run.captcha) {
            outcome = { summary: run.summary, steps: run.steps, mode: "auto" };
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
        emit({ type: "session", sessionId: desktopId });
        const run = await runBrowserAgent({
          sessionId: desktopId,
          startUrl: applyUrl,
          goal,
          facts,
          plan,
          maxSteps: 60,
          allowSubmit: true,
          steer: () => takeSteer(runId),
          onStep: step,
          onFrame: (image, pageTitle) => emit({ type: "frame", image, title: pageTitle }),
          onNeedHuman: (reason) => emit({ type: "need:human", reason }),
          onHumanDone: () => emit({ type: "human:done" }),
        });
        outcome = { summary: run.summary, steps: run.steps, mode: "manual" };
        await tell(
          "browser",
          `직접 조작 모드로 신청을 마쳤다. ${run.steps}번 조작했다. ${run.summary}`,
        );
        emit({ type: "done", summary: run.summary, steps: run.steps });
      } catch (error) {
        // 캡챠 앞에서 사람을 기다리다 포기한 것. 「실패」가 아니라 「사람이
        // 필요했는데 못 만났다」로 말해야 사용자가 무엇을 할지 안다.
        const text =
          error instanceof NeedsHuman
            ? `${error.message} 신청 페이지를 직접 열어 이어서 진행하세요.`
            : error instanceof Error
              ? error.message
              : String(error);
        outcome = {
          summary: null,
          steps: trace.length,
          mode: usedDesktop ? "manual" : "auto",
          error: text,
        };
        console.error("[start/apply] 신청 실패", error);
        emit({ type: "error", error: text });
      } finally {
        clearInterval(beat);
        // ⚠ 순서가 중요하다. 닫은 뒤에 emit 하면 `enqueue` 가 던지고 catch 가
        // 삼켜, 브라우저 카드가 running 인 채로 스트림이 끝난다 — 클라이언트는
        // 그걸 「연결이 끊겨 중단됐다」로 칠한다. 접수까지 마친 신청이 화면에서
        // 실패로 보이던 원인이 이 두 줄의 순서였다.
        // 준비 스트림과 같은 이유로, 종료 신호를 한 번은 반드시 보낸다.
        if (!closed) {
          emit({
            type: "error",
            error:
              "신청이 종료 신호 없이 끝났습니다. 서버 로그의 [start/apply] 항목을 확인하세요.",
          });
        }
        emit({ type: "agent", agent: "browser", status: "done" });
        try {
          controller.close();
        } catch {
          /* 이미 닫힘 */
        }

        /**
         * **서버가 기록한다.** 사용자가 화면을 닫아도 실행은 끝까지 가므로
         * (`enqueue` 만 실패한다), 여기서 안 쓰면 에이전트가 사용자 명의로
         * 접수해 놓고 아무 데도 남기지 않는 상태가 된다. 클라이언트가 하던
         * `/app/goals` PATCH 는 탭이 살아 있을 때만 도는 보조 경로다.
         */
        if (userId && goalId) {
          void saveApplyResult(userId, goalId, {
            ...outcome,
            finishedAt: new Date().toISOString(),
            trace: trace.slice(-200),
          });
        }
        closeRun(runId);
        // Xvfb·Chromium 은 프로세스다. 안 닫으면 신청 한 번마다 하나씩 남는다.
        // 자동 모드로만 끝났으면 띄운 적이 없으니 건드릴 것도 없다.
        if (usedDesktop) {
          setTimeout(() => void closeSession(desktopId).catch(() => {}), LINGER_MS);
        }
        /**
         * 이번 실행의 임시 파일을 치운다.
         *
         * 지우는 코드가 저장소에 하나도 없었다. 상시 컨테이너라 실행마다
         * 작성 문서 + PDF 사본 + 사용자 업로드(각 5MB)가 tmpdir 에 영구히
         * 쌓이고, 결국 로그 한 줄 없이 죽는다. 사람이 완료 화면을 보는
         * 동안(`LINGER_MS`)은 남겨 둔다 — 다시 시도할 수 있어야 한다.
         */
        setTimeout(
          () => void rm(runDir, { recursive: true, force: true }).catch(() => {}),
          LINGER_MS,
        );
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
