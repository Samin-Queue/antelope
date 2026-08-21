import { generateText, stepCountIs, tool, type LanguageModel } from "ai";
import { z } from "zod";

import { chatModel } from "@/lib/llm";

import { act, openSession, screenshot, settle, snapshot, type Snapshot } from "./browser";
import type { TraceEntry } from "./types";

/**
 * 브라우저를 조작하는 서브에이전트.
 *
 * 스냅샷 → 조작 → 재스냅샷 루프를 강제한다. 모델에게 자유를 주면 스냅샷 없이
 * 존재하지 않는 ref 를 찍는다.
 */
export async function runBrowserAgent(opts: {
  sessionId: string;
  goal: string;
  /** 폼에 채워 넣을 사실들. 여기 없는 값은 지어내지 말라고 지시한다 */
  facts?: Record<string, string>;
  startUrl?: string;
  maxSteps?: number;
  model?: LanguageModel;
  headless?: boolean;
  /** 조작을 실시간으로 흘려보낸다. 브라우저 에이전트는 보여야 값어치가 있다 */
  onStep?: (entry: TraceEntry) => void;
  /** 조작 직후 화면. 데모에서 이게 시간을 채운다 */
  onFrame?: (image: string, url: string) => void;
}) {
  const { sessionId, goal, facts = {}, startUrl, maxSteps = 24, headless = true } = opts;
  const { page } = await openSession(sessionId, headless);
  const trace: TraceEntry[] = [];
  let step = 0;

  const record = (name: string, input: unknown, output: string) => {
    const entry: TraceEntry = {
      step: ++step,
      tool: name,
      input,
      output,
      url: page.url(),
    };
    trace.push(entry);
    opts.onStep?.(entry);
  };

  /** 화면을 한 장 흘린다. 실패해도 조작은 계속한다 */
  const frame = async () => {
    if (!opts.onFrame) return;
    const image = await screenshot(page);
    if (image) opts.onFrame(image, page.url());
  };

  const describe = (snap: Snapshot) =>
    [
      `URL: ${snap.url}`,
      `제목: ${snap.title}`,
      "",
      "조작 가능한 요소:",
      ...snap.elements.map(
        (el) =>
          `  ${el.ref}  ${el.role}${el.type && el.type !== el.role ? `(${el.type})` : ""}  "${el.name}"` +
          (el.value ? `  현재값="${el.value}"` : "") +
          (el.disabled ? "  [비활성]" : ""),
      ),
      "",
      "본문:",
      snap.text.slice(0, 1200),
    ].join("\n");

  const tools = {
    snapshot: tool({
      description:
        "현재 페이지의 조작 가능한 요소와 본문을 가져온다. 조작 전에 반드시 먼저 호출한다.",
      inputSchema: z.object({}),
      execute: async () => {
        await settle(page);
        const snap = await snapshot(page);
        const text = describe(snap);
        await frame();
        record("snapshot", {}, `요소 ${snap.elements.length}개`);
        return text;
      },
    }),
    goto: tool({
      description: "지정한 URL 로 이동한다.",
      inputSchema: z.object({ url: z.string() }),
      execute: async ({ url }) => {
        const message = await act(page, { type: "goto", url });
        await frame();
        record("goto", { url }, message);
        return message;
      },
    }),
    click: tool({
      description: "요소를 클릭한다. ref 는 직전 snapshot 에서 본 것만 쓴다.",
      inputSchema: z.object({ ref: z.string() }),
      execute: async ({ ref }) => {
        const before = page.url();
        await act(page, { type: "click", ref });
        await settle(page);
        const after = page.url();

        // 제출을 눌렀는데 페이지가 그대로면 대개 필수 입력이 비어 있다.
        // 이걸 알려주지 않으면 모델이 이미 채운 칸을 계속 다시 채우며 헤맨다.
        const message =
          after === before
            ? `${ref} 를 클릭했지만 URL 이 바뀌지 않았다 (${after}). 필수 입력 누락이나 검증 실패일 수 있다. snapshot 으로 오류 메시지와 빈 칸을 확인하라.`
            : `${ref} 를 클릭했고 ${after} 로 이동했다.`;
        await frame();
        record("click", { ref }, message);
        return message;
      },
    }),
    fill: tool({
      description: "입력칸에 값을 채운다.",
      inputSchema: z.object({ ref: z.string(), value: z.string() }),
      execute: async ({ ref, value }) => {
        const message = await act(page, { type: "fill", ref, value });
        await frame();
        record("fill", { ref, value }, message);
        return message;
      },
    }),
    select: tool({
      description: "드롭다운에서 항목을 고른다. value 는 보이는 라벨 텍스트다.",
      inputSchema: z.object({ ref: z.string(), value: z.string() }),
      execute: async ({ ref, value }) => {
        const message = await act(page, { type: "select", ref, value });
        await frame();
        record("select", { ref, value }, message);
        return message;
      },
    }),
    check: tool({
      description: "체크박스나 라디오를 선택한다.",
      inputSchema: z.object({ ref: z.string() }),
      execute: async ({ ref }) => {
        const message = await act(page, { type: "check", ref });
        await frame();
        record("check", { ref }, message);
        return message;
      },
    }),
  };

  const result = await generateText({
    model: opts.model ?? chatModel(),
    tools,
    stopWhen: stepCountIs(maxSteps),
    system: [
      "너는 웹페이지를 대신 조작하는 에이전트다.",
      "",
      "규칙:",
      "- 조작하기 전에 반드시 snapshot 을 먼저 호출한다. ref 는 직전 snapshot 에 있던 것만 쓴다.",
      "- 폼을 채울 때는 **체크박스와 라디오를 먼저 처리한다.** 동의 항목이 비어 있으면",
      "  제출이 막히는데, 그 사실이 화면에 안 보여서 이미 채운 칸을 반복해 채우게 된다.",
      "- 이미 값이 들어있는 칸(snapshot 의 현재값)은 다시 채우지 않는다.",
      "- 페이지가 바뀌었을 수 있는 조작(click, goto) 뒤에는 다시 snapshot 을 호출한다.",
      "- 주어진 사실에 없는 값은 지어내지 않는다. 없으면 그 항목을 건너뛰고 마지막에 보고한다.",
      "- 결제·최종 제출·회원 탈퇴처럼 되돌릴 수 없는 버튼은 누르지 않는다. 직전에서 멈추고 보고한다.",
      "- 목표를 달성했거나 더 진행할 수 없으면 도구 호출을 멈추고 무엇을 했는지 한국어로 요약한다.",
    ].join("\n"),
    prompt: [
      `목표: ${goal}`,
      startUrl ? `시작 URL: ${startUrl}` : "",
      Object.keys(facts).length
        ? [
            "",
            "채워 넣을 사실:",
            ...Object.entries(facts).map(([k, v]) => `  ${k}: ${v}`),
          ].join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return {
    summary: result.text,
    steps: result.steps.length,
    trace,
    finalUrl: page.url(),
  };
}
