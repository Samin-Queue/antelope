import { existsSync } from "node:fs";
import { generateText, stepCountIs, tool, type LanguageModel } from "ai";
import { chromium, type Browser, type Page } from "playwright";
import { z } from "zod";

import { chatModel } from "@/lib/llm";

import { findCaptcha } from "./captcha";
import type { TraceEntry } from "./types";

/**
 * 자동 모드 — 캡챠가 없을 때 쓰는 빠른 길.
 *
 * 화면을 OCR 로 더듬는 대신 DOM 을 그대로 읽는다. 라벨·현재값·필수 여부·선택지가
 * 정확히 오므로 수동 모드가 겪던 문제가 통째로 사라진다 — 글자가 잘못 읽히는 일,
 * ○/● 를 못 알아봐 라디오를 여섯 번 누르는 일, 날짜 칸에 값이 깨져 들어가는 일.
 *
 * 대신 캡챠 앞에서는 무력하다. 그래서 조작할 때마다 캡챠를 확인하고, 보이면
 * 즉시 멈춰 `captcha` 를 달고 돌아간다. 호출부가 수동 모드로 갈아탄다.
 */
const SYSTEM_CHROMIUM = "/usr/bin/chromium";

export type PlaywrightRun = {
  summary: string;
  steps: number;
  trace: TraceEntry[];
  finalUrl: string;
  /** 캡챠를 만나 중단했다. 수동 모드로 넘겨야 한다 */
  captcha: { reason: string } | null;
};

/** 페이지에서 조작 가능한 요소만 뽑는다. 이게 모델이 보는 전부다 */
const SNAPSHOT = `(() => {
  const out = [];
  const sel = 'input,select,textarea,button,a[href],[role="button"],[role="checkbox"],[role="radio"]';
  let i = 0;
  for (const el of document.querySelectorAll(sel)) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (el.type === 'hidden') continue;
    i += 1;
    const ref = 'e' + i;
    el.setAttribute('data-antelope-ref', ref);

    let label = '';
    if (el.id) {
      const bound = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (bound) label = bound.innerText;
    }
    if (!label) { const wrap = el.closest('label'); if (wrap) label = wrap.innerText; }
    if (!label) label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    if (!label) label = (el.innerText || '').trim();
    if (!label && el.name) label = el.name;

    out.push({
      ref,
      tag: el.tagName.toLowerCase(),
      type: (el.getAttribute('type') || '').toLowerCase(),
      label: String(label).replace(/\\s+/g, ' ').trim().slice(0, 90),
      value: String(el.value ?? '').slice(0, 70),
      required: el.required === true || el.getAttribute('aria-required') === 'true',
      checked: el.checked === true,
      disabled: el.disabled === true,
      options: el.tagName === 'SELECT'
        ? Array.from(el.options).map((o) => o.text.trim()).filter(Boolean).slice(0, 25)
        : null,
    });
  }
  return { elements: out, text: (document.body?.innerText || '').replace(/\\n{2,}/g, '\\n').slice(0, 1800) };
})()`;

type Snapshot = {
  elements: Array<{
    ref: string;
    tag: string;
    type: string;
    label: string;
    value: string;
    required: boolean;
    checked: boolean;
    disabled: boolean;
    options: string[] | null;
  }>;
  text: string;
};

function launchOptions() {
  const executablePath = existsSync(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : undefined;
  return {
    headless: true,
    ...(executablePath
      ? {
          executablePath,
          // 컨테이너에서는 user namespace 가 막혀 샌드박스가 못 뜬다.
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        }
      : {}),
  };
}

export async function runPlaywrightAgent(opts: {
  goal: string;
  facts?: Record<string, string>;
  /**
   * 계획 에이전트가 세운 순서. 타입이 아니라 문자열 목록으로 받는다 —
   * 여기는 실험 폴더라 `app/start` 의 `PlanStep` 을 import 하면 의존 방향이
   * 거꾸로 선다. `human` 은 브라우저가 손대면 안 되는 일이다.
   */
  plan?: { browser?: string[]; human?: string[] };
  startUrl: string;
  maxSteps?: number;
  model?: LanguageModel;
  allowSubmit?: boolean;
  onStep?: (entry: TraceEntry) => void;
  onFrame?: (image: string, url: string) => void;
}): Promise<PlaywrightRun> {
  const { goal, facts = {}, plan, startUrl, maxSteps = 40, allowSubmit = false } = opts;

  let browser: Browser | null = null;
  const trace: TraceEntry[] = [];
  let step = 0;
  let captcha: { reason: string } | null = null;
  let snapshot: Snapshot = { elements: [], text: "" };

  try {
    browser = await chromium.launch(launchOptions());
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "ko-KR",
    });
    const page = await context.newPage();
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await settle(page);

    const record = async (name: string, input: unknown, output: string) => {
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

    const frame = async () => {
      if (!opts.onFrame) return;
      try {
        const jpeg = await page.screenshot({ type: "jpeg", quality: 45 });
        opts.onFrame(`data:image/jpeg;base64,${jpeg.toString("base64")}`, page.url());
      } catch {
        /* 페이지가 넘어가는 중 */
      }
    };

    /** 조작 전마다 캡챠를 본다. 나타나면 그 자리에서 멈춘다 */
    const guard = async () => {
      const check = await findCaptcha(page);
      if (check.found) {
        captcha = { reason: check.reason ?? "캡챠" };
        throw new CaptchaFound(captcha.reason);
      }
    };

    const locate = (ref: string) => {
      const found = snapshot.elements.find((el) => el.ref === ref);
      if (!found) throw new Error(`${ref} 는 직전 read 에 없다. read 를 다시 호출하라.`);
      return { el: found, locator: page.locator(`[data-antelope-ref="${ref}"]`) };
    };

    const read = async (): Promise<string> => {
      await settle(page);
      snapshot = (await page.evaluate(SNAPSHOT)) as Snapshot;
      await frame();
      await guard();
      const lines = snapshot.elements.map((el) => {
        const bits = [
          `${el.ref}`,
          `<${el.tag}${el.type ? ` type=${el.type}` : ""}>`,
          `"${el.label}"`,
        ];
        if (el.value) bits.push(`= "${el.value}"`);
        if (el.checked) bits.push("[선택됨]");
        if (el.required) bits.push("[필수]");
        if (el.disabled) bits.push("[비활성]");
        if (el.options?.length) bits.push(`선택지: ${el.options.join(" / ")}`);
        return "  " + bits.join(" ");
      });
      return [
        `URL: ${page.url()}`,
        `제목: ${await page.title()}`,
        "",
        "조작 가능한 요소:",
        ...lines,
        "",
        "화면 글:",
        snapshot.text,
      ].join("\n");
    };

    const tools = {
      read: tool({
        description:
          "페이지를 읽는다. 조작 가능한 요소 목록(e1, e2 …)과 화면 글을 돌려준다. 조작 전에 반드시 먼저 호출한다.",
        inputSchema: z.object({}),
        execute: async () => {
          const text = await read();
          await record("read", {}, `요소 ${snapshot.elements.length}개`);
          return text;
        },
      }),
      fill: tool({
        description:
          "입력칸에 값을 넣는다. 날짜 칸에는 YYYY-MM-DD 로 준다 — 표기 변환은 브라우저가 한다. 기존 값은 지우고 넣는다.",
        inputSchema: z.object({ ref: z.string(), value: z.string() }),
        execute: async ({ ref, value }) => {
          await guard();
          const { el, locator } = locate(ref);
          if (el.type === "file") {
            const message = `"${el.label}" 는 파일 업로드 칸이라 채울 수 없다. 사람이 올려야 한다 — 건너뛴다.`;
            await record("fill", { ref, skipped: true }, message);
            return message;
          }
          // 이미 같은 값이면 건드리지 않는다. 모델이 확인 삼아 같은 칸을 계속 다시
          // 채워 스텝을 태웠다(12칸에 fill 36번, 실측). 값을 되읽어 잘라낸다.
          const current = await locator.inputValue().catch(() => null);
          if (current !== null && current.trim() === value.trim()) {
            const message = `"${el.label}" 는 이미 "${value}" 다. 건너뛴다.`;
            await record("fill", { ref, skipped: true }, message);
            return message;
          }
          await locator.fill(value, { timeout: 10_000 });
          await settle(page, 400);
          await frame();
          const message = `"${el.label}" 에 "${value}" 를 넣었다.`;
          await record("fill", { ref, label: el.label, value }, message);
          return message;
        },
      }),
      click: tool({
        description:
          "버튼·링크·체크박스·라디오를 누른다. 이미 [선택됨] 인 항목은 다시 누르지 않는다.",
        inputSchema: z.object({ ref: z.string() }),
        execute: async ({ ref }) => {
          await guard();
          const { el, locator } = locate(ref);
          if (el.checked) {
            const message = `"${el.label}" 는 이미 선택돼 있다. 다시 누르면 해제되므로 건너뛴다.`;
            await record("click", { ref, skipped: true }, message);
            return message;
          }
          const before = page.url();
          await locator.click({ timeout: 10_000 });
          await settle(page);
          await frame();
          const moved = page.url() !== before;
          const message = `"${el.label}" 를 눌렀다.${moved ? ` 페이지가 ${page.url()} 로 바뀌었다.` : " read 로 결과를 확인하라."}`;
          await record("click", { ref, label: el.label }, message);
          return message;
        },
      }),
      select: tool({
        description:
          "드롭다운에서 항목을 고른다. option 은 read 가 보여준 선택지 글자다.",
        inputSchema: z.object({ ref: z.string(), option: z.string() }),
        execute: async ({ ref, option }) => {
          await guard();
          const { el, locator } = locate(ref);
          await locator
            .selectOption({ label: option }, { timeout: 10_000 })
            .catch(async () => {
              // 라벨이 안 맞으면 값으로 한 번 더 — 표기가 미세하게 다를 수 있다.
              await locator.selectOption(option, { timeout: 10_000 });
            });
          await settle(page, 400);
          await frame();
          const message = `"${el.label}" 에서 "${option}" 을 골랐다.`;
          await record("select", { ref, label: el.label, option }, message);
          return message;
        },
      }),
      scroll: tool({
        description: "화면을 내리거나 올린다. 아래에 더 있을 것 같으면 down.",
        inputSchema: z.object({ direction: z.enum(["down", "up"]) }),
        execute: async ({ direction }) => {
          await guard();
          await page.mouse.wheel(0, direction === "down" ? 700 : -700);
          await settle(page, 400);
          await frame();
          const message = `${direction === "down" ? "아래" : "위"}로 스크롤했다. read 를 다시 호출하라.`;
          await record("scroll", { direction }, message);
          return message;
        },
      }),
    };

    const result = await generateText({
      model: opts.model ?? chatModel(),
      tools,
      stopWhen: stepCountIs(maxSteps),
      system: systemPrompt(allowSubmit),
      prompt: promptFor(goal, startUrl, facts, plan),
    });

    return {
      summary: result.text,
      steps: result.steps.length,
      trace,
      finalUrl: page.url(),
      captcha: null,
    };
  } catch (error) {
    if (error instanceof CaptchaFound) {
      return {
        summary: `캡챠를 만나 자동 조작을 멈췄다 (${error.message}).`,
        steps: step,
        trace,
        finalUrl: startUrl,
        captcha: captcha ?? { reason: error.message },
      };
    }
    throw error;
  } finally {
    await browser?.close().catch(() => {});
  }
}

class CaptchaFound extends Error {}

async function settle(page: Page, extraMs = 700) {
  await page
    .waitForLoadState("networkidle", { timeout: 5_000 })
    .catch(() => page.waitForLoadState("domcontentloaded", { timeout: 3_000 }))
    .catch(() => {});
  await page.waitForTimeout(extraMs);
}

function systemPrompt(allowSubmit: boolean): string {
  return [
    "너는 웹 신청서를 대신 채우는 에이전트다. 페이지의 요소 목록을 보고 조작한다.",
    "",
    // 이 문단이 없으면 모델이 「정부 신청서를 대행하지 않는다」며 도구를 한 번도
    // 쓰지 않고 끝낸다(실측). 실제 조건을 사실대로 적어 둔다.
    "상황: 사용자가 자기 신청을 진행하려고 이 도구를 직접 실행했다. 아래 「채워 넣을 사실」은",
    "사용자가 방금 입력한 본인 정보다. 너는 그 값을 알맞은 칸에 옮겨 적는 입력 보조 도구이며,",
    "사용자는 진행 화면을 실시간으로 보고 있다. 없는 사실을 지어내지 않고 주어진 값만 옮긴다.",
    "",
    "규칙:",
    "- 조작 전에 반드시 read 를 먼저 호출한다. ref 는 직전 read 에 있던 것만 쓴다.",
    "- 날짜는 `2024-03-15` 형태로 fill 한다. 화면 표기(mm/dd/yyyy 등)로 바꾸지 않는다.",
    "- `[선택됨]` 인 체크박스·라디오는 다시 누르지 않는다. 같은 그룹에서 하나만 고른다.",
    "- 파일 업로드 칸은 채울 수 없다. 건너뛰고 마지막에 무엇이 남았는지 보고한다.",
    "- 여러 단계로 나뉜 폼은 한 단계를 다 채우고 「다음」을 눌러 넘어간다. 남은 단계가 있으면 끝난 게 아니다.",
    "- 값이 없는 항목은 비워 둔다. 지어내지 않는다.",
    "- **계획서가 주어지면 그 순서를 따른다.** 계획에 없는 곳으로 가지 않는다.",
    "- **「사람이 직접 해야 하는 것」에 적힌 일은 시도하지 않는다.** 증명서 발급·본인인증·서류 작성은 네 몫이 아니다. 그 자리에 오면 건너뛰고 마지막에 보고한다.",
    allowSubmit
      ? "- 결제·회원 탈퇴처럼 되돌릴 수 없는 조작은 하지 않는다. 단, **신청서 제출 버튼은 누른다** — 제출까지가 목표다. 제출 뒤 접수번호나 완료 문구가 보이면 read 로 확인하고 보고한다."
      : "- 결제·최종 제출·회원 탈퇴처럼 되돌릴 수 없는 버튼은 누르지 않는다. 직전에서 멈추고 보고한다.",
    "- 목표를 달성했거나 더 진행할 수 없으면 도구 호출을 멈추고 무엇을 했는지 한국어로 요약한다.",
    "  채우지 못한 항목과 그 이유(값 없음·파일 필요)를 반드시 적는다.",
  ].join("\n");
}

function promptFor(
  goal: string,
  startUrl: string,
  facts: Record<string, string>,
  plan?: { browser?: string[]; human?: string[] },
): string {
  return [
    `목표: ${goal}`,
    `시작 URL: ${startUrl} (이미 열려 있다)`,
    plan?.browser?.length
      ? [
          "",
          "계획서 — 네가 할 순서:",
          ...plan.browser.map((line, index) => `  ${index + 1}. ${line}`),
        ].join("\n")
      : "",
    plan?.human?.length
      ? [
          "",
          "사람이 직접 해야 하는 것 (너는 하지 않는다):",
          ...plan.human.map((line) => `  - ${line}`),
        ].join("\n")
      : "",
    Object.keys(facts).length
      ? [
          "",
          "채워 넣을 사실:",
          ...Object.entries(facts).map(([k, v]) => `  ${k}: ${v}`),
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * 조작 없이 캡챠만 확인한다.
 *
 * 신청을 시작하기 전에 어느 모드로 갈지 정하는 데 쓴다. 여는 비용이 아깝지만,
 * 잘못 골라 자동 모드로 갔다가 캡챠 앞에서 헛도는 것보다 훨씬 싸다.
 */
export async function probeCaptcha(
  url: string,
): Promise<{ found: boolean; reason: string | null }> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch(launchOptions());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await settle(page);
    return await findCaptcha(page);
  } catch (error) {
    // 열지 못했으면 캡챠 여부를 모른다. 모르면 자동으로 간다 — 자동이 실패하면
    // 그때 캡챠를 만나 수동으로 넘어간다. 여기서 수동을 고르면 멀쩡한 폼도 느려진다.
    return { found: false, reason: error instanceof Error ? error.message : null };
  } finally {
    await browser?.close().catch(() => {});
  }
}
