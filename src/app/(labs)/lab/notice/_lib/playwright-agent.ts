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
    if (el.type === 'hidden') continue;
    // ⚠ 파일 입력만 가시성 검사를 건너뛴다.
    // 요즘 업로드 UI 는 진짜 input 을 감추고(class="hidden") 드롭존을 대신 그린다.
    // 우리 데모도 그렇다. 가시성으로 거르면 붙일 칸이 목록에서 통째로 사라져
    // upload 도구가 영영 쓰이지 못하고, 에이전트는 「업로드 칸이 없다」고 보고한다.
    // setInputFiles 는 숨은 input 에도 정상 동작하므로 남겨 두는 편이 맞다.
    const isFile = el.tagName === 'INPUT' && el.type === 'file';
    if (!isFile) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
    }
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
      // 브라우저가 이미 아는 것을 모델에게 추측시키지 않는다. HTML5 검증은
      // 「왜 제출이 안 되는가」를 사이트마다 다른 문구가 아니라 표준으로 말해 준다.
      invalid: typeof el.checkValidity === 'function' ? !el.checkValidity() : false,
      validationMessage: String(el.validationMessage || '').slice(0, 120),
      // 파일 칸이 받는 형식. 안 맞는 파일을 올리면 브라우저가 조용히 무시한다.
      accept: String(el.getAttribute('accept') || '').slice(0, 120),
      multiple: el.multiple === true,
      // 폼 밖으로 나가는 링크. 누르면 되돌아오느라 시간을 태운다.
      href: el.tagName === 'A' ? String(el.getAttribute('href') || '').slice(0, 200) : '',
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
    invalid: boolean;
    validationMessage: string;
    accept: string;
    multiple: boolean;
    href: string;
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
  /**
   * 파일 에이전트가 만들어 둔 제출용 파일. 업로드 칸에 이걸 넣는다.
   * 없으면 예전처럼 「사람이 올려야 한다」로 건너뛴다.
   */
  artifacts?: Array<{ label: string; filename: string; path: string }>;
  startUrl: string;
  maxSteps?: number;
  model?: LanguageModel;
  allowSubmit?: boolean;
  onStep?: (entry: TraceEntry) => void;
  onFrame?: (image: string, url: string) => void;
}): Promise<PlaywrightRun> {
  const {
    goal,
    facts = {},
    plan,
    artifacts = [],
    startUrl,
    maxSteps = 40,
    allowSubmit = false,
  } = opts;

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
        if (el.invalid)
          bits.push(`[미충족${el.validationMessage ? ` ${el.validationMessage}` : ""}]`);
        if (el.options?.length) bits.push(`선택지: ${el.options.join(" / ")}`);
        if (el.accept) bits.push(`받는 형식: ${el.accept}`);
        // 폼 밖으로 나가는 링크는 눌러도 되돌려진다. 미리 알려 왕복을 없앤다.
        if (el.href && leavesForm(startUrl, el.href, page.url())) bits.push("[폼 밖]");
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
          "페이지를 읽는다. 조작 가능한 요소 목록(e1, e2 …)과 화면 글을 돌려준다. 맨 처음 한 번만 부르면 된다 — click 은 결과 화면을 함께 돌려준다.",
        inputSchema: z.object({}),
        execute: async () => {
          const text = await read();
          await record("read", {}, `요소 ${snapshot.elements.length}개`);
          return text;
        },
      }),
      diagnose: tool({
        description:
          "제출·다음이 막혔을 때 무엇이 막고 있는지 브라우저에게 직접 묻는다. 추측하지 말고 이걸 부른다.",
        inputSchema: z.object({}),
        execute: async () => {
          await guard();
          snapshot = (await page.evaluate(SNAPSHOT)) as Snapshot;

          const blockers = snapshot.elements.filter(
            (el) =>
              el.invalid ||
              (el.required &&
                !el.value &&
                el.type !== "checkbox" &&
                el.type !== "radio") ||
              (el.required &&
                (el.type === "checkbox" || el.type === "radio") &&
                !el.checked),
          );
          const uploads = snapshot.elements.filter(
            (el) => el.type === "file" && !el.value,
          );
          const dead = snapshot.elements.filter(
            (el) => el.disabled && /제출|신청|다음|완료|확인/.test(el.label),
          );

          const lines: string[] = [];
          if (blockers.length) {
            lines.push("채우지 못한 필수 항목:");
            for (const el of blockers) {
              lines.push(
                `  ${el.ref} "${el.label}"${el.validationMessage ? ` — ${el.validationMessage}` : ""}`,
              );
            }
          }
          if (uploads.length) {
            lines.push("비어 있는 파일 칸:");
            for (const el of uploads) lines.push(`  ${el.ref} "${el.label}"`);
            lines.push(
              artifacts.length
                ? `  준비된 파일: ${artifacts.map((a) => a.filename).join(", ")} — 맞는 칸에 upload 한다.`
                : "  준비된 파일이 없다. 이 서류는 사람이 발급받아야 하므로 여기서 끝내고 보고한다.",
            );
          }
          if (dead.length) {
            lines.push(
              `비활성 버튼: ${dead.map((el) => `"${el.label}"`).join(", ")} — 위 항목을 채우면 풀린다.`,
            );
          }

          const message = lines.length
            ? lines.join("\n")
            : "막는 것을 찾지 못했다. 화면 아래에 더 있을 수 있으니 scroll 후 read 한다.";
          await record("diagnose", {}, `막는 것 ${blockers.length + uploads.length}개`);
          return message;
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
            const message = artifacts.length
              ? `"${el.label}" 는 파일 업로드 칸이다. fill 이 아니라 **upload** 로 넣는다.`
              : `"${el.label}" 는 파일 업로드 칸이라 채울 수 없다. 사람이 올려야 한다 — 건너뛴다.`;
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

          // 신청 폼을 벗어나면 되돌린다. 실측: 「← 공고문으로」 를 눌러 폼을 잃고
          // 되돌아와 처음부터 다시 채우다 60스텝을 태웠다. 규칙으로 적어도
          // 모델이 어기므로 코드가 막는다.
          if (left(startUrl, page.url())) {
            await page.goBack({ timeout: 15_000 }).catch(() => {});
            await settle(page);
            await frame();
            const message = `"${el.label}" 는 신청 폼을 벗어나는 링크였다. 되돌아왔다 — 폼 안에서만 조작하라.`;
            await record("click", { ref, label: el.label, reverted: true }, message);
            return message;
          }

          // 누른 뒤 화면을 **그 자리에서** 돌려준다.
          //
          // 「read 로 확인하라」고 안내하면 모델이 click → read 를 왕복한다.
          // 실측: 도구 71회에 245초, 병목은 도구 실행이 아니라 모델 왕복이었고
          // read 가 16회였다. 화면이 바뀌는 조작은 결과를 함께 주면 그 절반이 준다.
          const changed = await read();
          const message = [
            `"${el.label}" 를 눌렀다.${page.url() !== before ? ` 페이지가 바뀌었다.` : ""}`,
            "",
            changed,
          ].join("\n");
          await record("click", { ref, label: el.label }, `"${el.label}" 클릭`);
          return message;
        },
      }),
      upload: tool({
        description:
          "파일 업로드 칸에 준비된 파일을 넣는다. file 은 「준비된 파일」 목록의 이름 그대로 쓴다.",
        inputSchema: z.object({ ref: z.string(), file: z.string() }),
        execute: async ({ ref, file }) => {
          await guard();
          const { el, locator } = locate(ref);
          if (el.type !== "file") {
            const message = `"${el.label}" 는 파일 칸이 아니다. fill 을 쓴다.`;
            await record("upload", { ref, file }, message);
            return message;
          }
          // 이름이 조금 어긋나도 붙는다 — 모델이 라벨과 파일명을 섞어 부른다.
          const picked =
            artifacts.find((item) => item.filename === file) ??
            artifacts.find((item) => item.label === file) ??
            artifacts.find(
              (item) => item.filename.includes(file) || file.includes(item.label),
            );
          if (!picked) {
            const message = artifacts.length
              ? `"${file}" 라는 준비된 파일이 없다. 있는 것: ${artifacts.map((i) => i.filename).join(", ")}`
              : "준비된 파일이 없다. 이 칸은 건너뛰고 마지막에 보고한다.";
            await record("upload", { ref, file }, message);
            return message;
          }
          // 안 맞는 형식을 넣으면 브라우저가 **조용히 무시한다.** 실측: `.pdf` 만
          // 받는 칸에 `.hwp` 를 올리고 성공한 줄 알았다가 제출에서 막혔다.
          if (!accepts(el.accept, picked.filename)) {
            const fit = artifacts.find((item) => accepts(el.accept, item.filename));
            const message = fit
              ? `"${el.label}" 는 ${el.accept} 만 받는다. ${picked.filename} 대신 ${fit.filename} 을 올려라.`
              : `"${el.label}" 는 ${el.accept} 만 받는데 준비된 파일에 맞는 것이 없다(${artifacts.map((i) => i.filename).join(", ") || "없음"}). 이 칸은 사람이 올려야 한다 — 건너뛰고 보고한다.`;
            await record("upload", { ref, file, rejected: true }, message);
            return message;
          }

          await locator.setInputFiles(picked.path, { timeout: 15_000 });
          const after = (await page.evaluate(SNAPSHOT)) as Snapshot;
          const slot = after.elements.find((item) => item.ref === ref);
          if (slot && !slot.value) {
            const message = `"${el.label}" 에 ${picked.filename} 을 넣었지만 칸이 비어 있다. 이 사이트가 그 형식을 받지 않는 것이다 — 건너뛰고 보고한다.`;
            await record("upload", { ref, file: picked.filename, empty: true }, message);
            return message;
          }
          const message = `"${el.label}" 에 ${picked.filename} 을 올렸다.`;
          await record("upload", { ref, file: picked.filename }, message);
          await frame();
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

    /**
     * 브라우저 조작을 한 줄로 세운다.
     *
     * 모델은 도구를 **병렬로** 부른다. `fill` 여덟 개가 같은 순간에 들어가면
     * React 폼이 배치 업데이트로 서로를 덮어써 값이 남지 않는다 — 실측: 같은
     * 여덟 칸을 세 번씩 다시 채우다 끝났다. 조작은 본질적으로 순차다.
     *
     * 도구마다 감싸지 않고 정의 뒤에 한 번에 두른다. 새 도구를 더해도
     * 직렬화를 잊을 자리가 없다.
     */
    let chain: Promise<unknown> = Promise.resolve();
    for (const entry of Object.values(tools)) {
      const original = entry.execute as (...args: unknown[]) => Promise<unknown>;
      entry.execute = ((...args: unknown[]) => {
        const next = chain.then(
          () => original(...args),
          () => original(...args),
        );
        chain = next.then(
          () => undefined,
          () => undefined,
        );
        return next;
      }) as typeof entry.execute;
    }

    const result = await generateText({
      model: opts.model ?? chatModel(),
      tools,
      stopWhen: stepCountIs(maxSteps),
      system: systemPrompt(allowSubmit, artifacts.length > 0),
      prompt: promptFor(goal, startUrl, facts, plan, artifacts),
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

/**
 * 신청 폼을 벗어났는가.
 *
 * 호스트가 다르면 확실히 벗어난 것이고, 같은 호스트라면 경로의 첫 두 마디가
 * 유지되는지 본다 — `/demo/startup-fund/apply` 에서 `/demo/startup-fund` 로
 * 나가는 것이 실제로 문제였던 이동이다. 다단계 폼이 쿼리·해시를 바꾸는 것은
 * 이탈이 아니다.
 */
/** 이 링크를 누르면 폼을 벗어나는가. 상대 경로를 현재 URL 기준으로 푼다. */
function leavesForm(startUrl: string, href: string, current: string): boolean {
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) return false;
  try {
    return left(startUrl, new URL(href, current).href);
  } catch {
    return false;
  }
}

function left(startUrl: string, current: string): boolean {
  try {
    const from = new URL(startUrl);
    const to = new URL(current);
    if (from.host !== to.host) return true;
    const head = (url: URL) =>
      url.pathname.split("/").filter(Boolean).slice(0, 2).join("/");
    return head(from) !== head(to) || to.pathname.length < from.pathname.length;
  } catch {
    return false;
  }
}

/**
 * 이 파일 칸이 그 파일을 받는가.
 *
 * `accept` 는 `.pdf,.hwp` 처럼 확장자로도, `image/*` 처럼 MIME 로도 온다.
 * 비어 있으면 아무거나 받는다는 뜻이다 — 그때는 막지 않는다.
 */
function accepts(accept: string, filename: string): boolean {
  const rules = accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;
  const ext = filename.toLowerCase().replace(/^.*(?=\.)/, "");
  return rules.some((rule) => {
    if (rule.startsWith(".")) return rule === ext;
    if (rule.endsWith("/*")) return true; // MIME 대분류는 여기서 못 가린다
    return false;
  });
}

function systemPrompt(allowSubmit: boolean, hasArtifacts: boolean): string {
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
    "- `[폼 밖]` 이 붙은 링크는 누르지 않는다. 눌러도 자동으로 되돌려지고 시간만 태운다.",
    "- 맨 처음 한 번 read 한다. **click 은 바뀐 화면을 함께 돌려주므로 그 뒤에 read 를 또 부르지 않는다.** ref 는 가장 최근에 받은 목록의 것만 쓴다.",
    "- **여러 칸은 fill 을 한 번에 여러 개 호출해 채운다.** 한 칸씩 왕복하면 그만큼 느려진다.",
    "- 날짜는 `2024-03-15` 형태로 fill 한다. 화면 표기(mm/dd/yyyy 등)로 바꾸지 않는다.",
    "- `[선택됨]` 인 체크박스·라디오는 다시 누르지 않는다. 같은 그룹에서 하나만 고른다.",
    hasArtifacts
      ? "- **파일 업로드 칸에는 upload 를 쓴다.** 「준비된 파일」 목록에 있는 이름을 그대로 넘긴다. 목록에 없는 서류(발급받아야 하는 것)는 건너뛰고 마지막에 보고한다."
      : "- 파일 업로드 칸은 채울 수 없다. 건너뛰고 마지막에 무엇이 남았는지 보고한다.",
    "- 여러 단계로 나뉜 폼은 한 단계를 다 채우고 「다음」을 눌러 넘어간다. 남은 단계가 있으면 끝난 게 아니다.",
    "- 값이 없는 항목은 비워 둔다. 지어내지 않는다.",
    "- **라벨의 단위 표기를 그대로 따른다.** 「총사업비 (천원)」 에 1억을 넣으려면 `100000` 이다. 「%」·「백만원」·「개월」 도 같다.",
    "- **막히면 추측하지 말고 diagnose 를 부른다.** 무엇이 비었고 무엇이 막고 있는지 브라우저가 직접 답한다. 「이전」 을 눌러 앞 단계를 뒤지기 전에 이걸 먼저 한다.",
    "- diagnose 가 「사람이 발급받아야 한다」 고 하면 더 밀지 않는다. 무엇이 없어 못 냈는지 보고하고 끝낸다.",
    "- `[미충족]` 이 붙은 칸은 브라우저가 값을 거부한 것이다. 같은 값을 다시 넣지 말고 형식을 바꾼다.",
    "- **입력칸은 click 하지 않는다. 바로 fill 한다.** 클릭은 버튼·체크박스·라디오에만 쓴다 — 칸을 누르고 채우면 스텝이 두 배가 된다.",
    "- **신청 폼을 벗어나지 않는다.** 「← 공고문으로」·「목록」·「이전」 처럼 폼 밖으로 나가는 링크는 누르지 않는다. 지금 폼을 끝내는 것이 전부다.",
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
  artifacts: Array<{ label: string; filename: string }> = [],
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
    artifacts.length
      ? [
          "",
          "준비된 파일 (upload 로 올린다):",
          ...artifacts.map((item) => `  ${item.filename}  — ${item.label}`),
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
