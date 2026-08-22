import { generateText, stepCountIs, tool, type LanguageModel } from "ai";
import { z } from "zod";

import { chatModel } from "@/lib/llm";

import {
  changeRatio,
  input,
  openSession,
  screenshot,
  screenshotPng,
  setHold,
  settle,
  title,
  typeText,
  waitWhileHeld,
} from "./desktop";
import { looksLikeCaptcha, readScreen, type ScreenRead } from "./ocr";
import type { TraceEntry } from "./types";

/**
 * 브라우저를 조작하는 서브에이전트 — 화면만 보고 일한다.
 *
 * 루프는 전과 같다: 읽기 → 조작 → 다시 읽기. 달라진 건 "읽기" 의 출처다.
 * DOM 스냅샷 대신 스크린샷을 OCR 한 글자 목록(t1, t2 …)을 모델에게 준다.
 * 모델은 그 글자를 가리켜 조작하고, 우리는 그 글자의 좌표를 실제 마우스로 누른다.
 *
 * URL 을 모른다는 게 가장 큰 차이다. 전환 여부는 창 제목과 화면 변화율로
 * 판정해서 모델에게 알린다 — 제출을 눌렀는데 화면이 그대로면 대개 검증 실패다.
 */
export async function runBrowserAgent(opts: {
  sessionId: string;
  goal: string;
  /** 폼에 채워 넣을 사실들. 여기 없는 값은 지어내지 말라고 지시한다 */
  facts?: Record<string, string>;
  startUrl?: string;
  maxSteps?: number;
  model?: LanguageModel;
  /** 조작을 실시간으로 흘려보낸다. 브라우저 에이전트는 보여야 값어치가 있다 */
  onStep?: (entry: TraceEntry) => void;
  /** 조작 직후 화면. 데모에서 이게 시간을 채운다 */
  onFrame?: (image: string, url: string) => void;
  /** 캡챠처럼 사람이 필요할 때. 돌아오면 사람이 끝낸 것이다 */
  onNeedHuman?: (reason: string) => void;
  onHumanDone?: () => void;
  /**
   * 최종 제출까지 누른다. 기본은 직전에서 멈춘다 — 되돌릴 수 없는 조작은
   * 사람이 허락한 경우에만 한다.
   */
  allowSubmit?: boolean;
}) {
  const {
    sessionId,
    goal,
    facts = {},
    startUrl,
    maxSteps = 24,
    allowSubmit = false,
  } = opts;
  await openSession(sessionId, startUrl ?? "about:blank");
  // 첫 read 가 로딩 중 빈 화면을 읽으면 모델이 "화면이 비었다" 고 판단해 좌표를
  // 찍기 시작하고 회복하지 못한다. 화면이 멈출 때까지 한 번 더 기다린다.
  await settle(sessionId, 6_000);

  const trace: TraceEntry[] = [];
  let step = 0;
  let last: ScreenRead | null = null;
  let lastTitle = "";

  const record = async (name: string, input: unknown, output: string) => {
    const entry: TraceEntry = { step: ++step, tool: name, input, output, url: lastTitle };
    trace.push(entry);
    opts.onStep?.(entry);
  };

  /** 화면을 한 장 흘린다. 실패해도 조작은 계속한다 */
  const frame = async () => {
    if (!opts.onFrame) return;
    try {
      const jpeg = await screenshot(sessionId, 45);
      opts.onFrame(`data:image/jpeg;base64,${jpeg.toString("base64")}`, lastTitle);
    } catch {
      /* 세션이 닫히는 중 */
    }
  };

  const refOf = (ref: string) => {
    const found = last?.refs.find((r) => r.ref === ref);
    if (!found) {
      throw new Error(`${ref} 는 직전 read 에 없다. read 를 다시 호출하라.`);
    }
    return found;
  };

  /** 사람이 잡고 있으면 기다린다. 캡챠가 보이면 먼저 사람을 부른다 */
  const guard = async (read?: ScreenRead) => {
    if (read && looksLikeCaptcha(read.text) && opts.onNeedHuman) {
      setHold(sessionId, true);
      opts.onNeedHuman("캡챠가 보입니다. 직접 풀어주세요.");
      await record("need:human", {}, "캡챠 — 사람을 기다린다");
      await waitWhileHeld(sessionId);
      opts.onHumanDone?.();
    } else {
      await waitWhileHeld(sessionId);
    }
  };

  const read = async (): Promise<string> => {
    await settle(sessionId);
    const png = await screenshotPng(sessionId);
    const result = await readScreen(png);
    last = result;
    lastTitle = await title(sessionId);
    await frame();
    await guard(result);
    return [
      `제목: ${lastTitle || "(없음)"}`,
      "",
      "화면의 글자 (위에서 아래로):",
      ...result.refs.map((r) => `  ${r.ref}  "${r.text}"`),
    ].join("\n");
  };

  /** 조작 뒤 화면이 바뀌었는지. CDP 의 page.url() 을 대신한다 */
  const transition = async () => {
    const before = lastTitle;
    await settle(sessionId);
    const ratio = await changeRatio(sessionId);
    lastTitle = await title(sessionId);
    if (lastTitle !== before) return `페이지가 바뀌었다 (제목: ${lastTitle}).`;
    if (ratio > 0.35) return "화면이 크게 바뀌었다.";
    if (ratio > 0.03) return "화면 일부가 바뀌었다.";
    return "화면이 거의 그대로다. 필수 입력 누락이나 검증 실패일 수 있다. read 로 오류 문구를 확인하라.";
  };

  const tools = {
    read: tool({
      description:
        "화면을 읽는다. 보이는 글자 목록(t1, t2 …)과 제목을 돌려준다. 조작 전에 반드시 먼저 호출한다.",
      inputSchema: z.object({}),
      execute: async () => {
        const text = await read();
        await record("read", {}, `글자 ${last?.refs.length ?? 0}줄`);
        return text;
      },
    }),
    click: tool({
      description:
        "글자를 클릭한다. 버튼·링크·체크박스 라벨·드롭다운 라벨 전부 이걸로 누른다. ref 는 직전 read 에서 본 것만 쓴다.",
      inputSchema: z.object({ ref: z.string() }),
      execute: async ({ ref }) => {
        await guard();
        const target = refOf(ref);
        await input(sessionId, { kind: "click", x: target.cx, y: target.cy });
        const message = `"${target.text}" 를 클릭했다. ${await transition()}`;
        await frame();
        await record("click", { ref, text: target.text }, message);
        return message;
      },
    }),
    type: tool({
      description:
        "입력칸에 값을 넣는다. ref 에는 그 칸의 **라벨이나 플레이스홀더 글자**를 준다 — 라벨을 누르면 연결된 칸에 포커스가 간다. 기존 값은 지우고 넣는다.",
      inputSchema: z.object({ ref: z.string(), value: z.string() }),
      execute: async ({ ref, value }) => {
        await guard();
        const target = refOf(ref);
        await input(sessionId, { kind: "click", x: target.cx, y: target.cy });
        await input(sessionId, { kind: "key", key: "ctrl+a" });
        await typeText(sessionId, value);
        await settle(sessionId, 800);
        const message = `"${target.text}" 칸에 "${value}" 를 입력했다.`;
        await frame();
        await record("type", { ref, text: target.text, value }, message);
        return message;
      },
    }),
    select: tool({
      description:
        "드롭다운에서 항목을 고른다. ref 는 드롭다운의 라벨이나 현재 보이는 값, option 은 고를 항목의 글자다.",
      inputSchema: z.object({ ref: z.string(), option: z.string() }),
      execute: async ({ ref, option }) => {
        await guard();
        const target = refOf(ref);
        await input(sessionId, { kind: "click", x: target.cx, y: target.cy });
        await settle(sessionId, 600);
        // 네이티브 <select> 는 열린 상태에서 글자를 치면 그 항목으로 이동한다
        await typeText(sessionId, option);
        await input(sessionId, { kind: "key", key: "Return" });
        await settle(sessionId, 600);
        const message = `"${target.text}" 에서 "${option}" 을 골랐다. read 로 반영됐는지 확인하라.`;
        await frame();
        await record("select", { ref, text: target.text, option }, message);
        return message;
      },
    }),
    press: tool({
      description: "키를 누른다. Tab, Return, Escape, Page_Down 같은 X 키 이름을 쓴다.",
      inputSchema: z.object({ key: z.string() }),
      execute: async ({ key }) => {
        await guard();
        await input(sessionId, { kind: "key", key });
        const message = `${key} 를 눌렀다. ${await transition()}`;
        await frame();
        await record("press", { key }, message);
        return message;
      },
    }),
    scroll: tool({
      description: "화면을 내리거나 올린다. 아래에 더 있을 것 같으면 down.",
      inputSchema: z.object({ direction: z.enum(["down", "up"]) }),
      execute: async ({ direction }) => {
        await guard();
        await input(sessionId, {
          kind: "scroll",
          x: 640,
          y: 450,
          dy: direction === "down" ? 600 : -600,
        });
        await settle(sessionId, 600);
        const message = `${direction === "down" ? "아래" : "위"}로 스크롤했다. read 를 다시 호출하라.`;
        await frame();
        await record("scroll", { direction }, message);
        return message;
      },
    }),
    click_at: tool({
      description:
        "글자가 없는 곳(아이콘·빈 체크박스·이미지)을 좌표로 클릭한다. 화면은 1280×900 이다. 글자로 누를 수 있으면 click 을 쓴다.",
      inputSchema: z.object({ x: z.number(), y: z.number() }),
      execute: async ({ x, y }) => {
        await guard();
        await input(sessionId, { kind: "click", x, y });
        const message = `(${x}, ${y}) 를 클릭했다. ${await transition()}`;
        await frame();
        await record("click_at", { x, y }, message);
        return message;
      },
    }),
  };

  const result = await generateText({
    model: opts.model ?? chatModel(),
    tools,
    stopWhen: stepCountIs(maxSteps),
    system: [
      "너는 웹페이지를 대신 조작하는 에이전트다. 화면에 보이는 글자 목록만으로 일한다.",
      "",
      "규칙:",
      "- 조작하기 전에 반드시 read 를 먼저 호출한다. ref 는 직전 read 에 있던 것만 쓴다.",
      "- **거의 모든 조작은 click·type·select 로 한다. ref(t1, t2 …)를 반드시 쓴다.** click_at 은 글자가 전혀 없는 아이콘·빈 체크박스에만 쓰는 최후 수단이다. 좌표를 짐작해서 찍지 않는다.",
      "- read 결과에 글자 목록이 비어 있으면 페이지가 아직 로딩 중이다. 좌표를 찍지 말고 read 를 한 번 더 호출해 기다린다.",
      "- **이 페이지를 절대 벗어나지 않는다.** 뒤로가기(←)·목록으로·주소창·새 탭·검색은 누르지 않는다. 현재 폼을 채우는 것이 전부다.",
      "- 화면의 항목을 다 채웠으면 scroll down 으로 아래를 확인한다. 폼은 한 화면보다 길다 — 제출 버튼은 맨 아래에 있다.",
      "- 입력칸은 그 칸의 라벨 글자나 플레이스홀더 글자를 ref 로 type 한다. 칸 자체를 찾으려 하지 않는다.",
      "- 폼을 채울 때는 **체크박스와 라디오를 먼저 처리한다.** 라벨 글자를 click 하면 선택된다.",
      "- 페이지가 바뀌었을 수 있는 조작(click, press) 뒤에는 다시 read 한다.",
      '- 조작 결과에 "화면이 거의 그대로다" 가 오면 오류 문구가 떴을 가능성이 높다. read 로 확인하고 빈 칸을 채운다.',
      "- 같은 칸에 같은 값을 두 번 넣지 않는다. read 에 이미 그 값이 보이면 건너뛴다.",
      "- 아래에 더 있을 것 같으면 scroll 한다. 화면은 1280×900 이라 긴 폼은 한 화면에 다 안 보인다.",
      "- 주어진 사실에 없는 값은 지어내지 않는다. 없으면 그 항목을 건너뛰고 마지막에 보고한다.",
      allowSubmit
        ? "- 결제·회원 탈퇴처럼 되돌릴 수 없는 버튼은 누르지 않는다. 단, **신청서 제출 버튼은 누른다** — 제출까지가 목표다. 제출 후 접수 완료 화면이나 접수번호가 보이면 read 로 확인하고 보고한다."
        : "- 결제·최종 제출·회원 탈퇴처럼 되돌릴 수 없는 버튼은 누르지 않는다. 직전에서 멈추고 보고한다.",
      "- 캡챠가 보이면 기다리라는 안내가 온다. 그때는 아무것도 하지 말고 다음 결과를 기다린다.",
      "- 목표를 달성했거나 더 진행할 수 없으면 도구 호출을 멈추고 무엇을 했는지 한국어로 요약한다.",
    ].join("\n"),
    prompt: [
      `목표: ${goal}`,
      startUrl ? `시작 URL: ${startUrl} (이미 열려 있다)` : "",
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
    finalUrl: lastTitle,
  };
}
