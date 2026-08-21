import { chromium, type Browser, type Page } from "playwright";

/**
 * 에이전트가 쓰는 브라우저 레이어.
 *
 * 스냅샷 → 조작 → 재스냅샷 루프를 전제로 한다. 요소는 매 스냅샷마다 DOM 에
 * `data-antelope-ref` 를 심어 식별한다. Playwright 의 내부 aria-ref 에 기대지
 * 않는 이유는 버전마다 동작이 달라서다 (1.62 에서는 ref 마커가 붙지 않았다).
 */
export type ElementRef = {
  ref: string;
  role: string;
  name: string;
  value?: string;
  /** input 의 type. 무엇을 채워야 하는지 판단하는 데 쓴다 */
  type?: string;
  disabled?: boolean;
};

export type Snapshot = {
  url: string;
  title: string;
  elements: ElementRef[];
  /** 화면에 보이는 본문 텍스트 요약. 무슨 페이지인지 모델이 알아야 한다 */
  text: string;
};

type Session = { browser: Browser; page: Page; createdAt: number };

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 15 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      void session.browser.close().catch(() => {});
      sessions.delete(id);
    }
  }
}

export async function openSession(id: string, headless = true): Promise<Session> {
  sweep();
  const existing = sessions.get(id);
  if (existing) return existing;

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    locale: "ko-KR",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const session = { browser, page, createdAt: Date.now() };
  sessions.set(id, session);
  return session;
}

export async function closeSession(id: string) {
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  await session.browser.close().catch(() => {});
}

export function hasSession(id: string) {
  return sessions.has(id);
}

/**
 * 페이지 안에서 실행되는 스크립트.
 *
 * ⚠ 함수가 아니라 **문자열**로 넘긴다. tsx·esbuild·Next 번들러가 인라인 함수를
 * 변환하면서 `__name` 같은 헬퍼를 주입하는데, 브라우저 컨텍스트에는 그 헬퍼가
 * 없어 `__name is not defined` 로 죽는다. 문자열은 변환을 타지 않는다.
 */
const SNAPSHOT_SCRIPT = `(() => {
  const SELECTOR = [
    "a[href]", "button", "input:not([type=hidden])", "textarea", "select",
    "[role=button]", "[role=link]", "[role=checkbox]", "[role=radio]",
    "[contenteditable=true]"
  ].join(",");

  function visible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function label(el) {
    const aria = el.getAttribute("aria-label");
    if (aria) return aria;
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const target = document.getElementById(labelledBy);
      if (target && target.textContent) return target.textContent.trim();
    }
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea") {
      const wrapping = el.closest("label");
      if (wrapping && wrapping.textContent) return wrapping.textContent.replace(/\\s+/g, " ").trim();
      const id = el.getAttribute("id");
      if (id) {
        const forLabel = document.querySelector('label[for="' + id + '"]');
        if (forLabel && forLabel.textContent) return forLabel.textContent.replace(/\\s+/g, " ").trim();
      }
      return el.placeholder || el.name || "";
    }
    return (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80);
  }

  function role(el) {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === "a") return "link";
    if (tag === "button") return "button";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "input") {
      const t = el.type;
      if (["checkbox", "radio", "file", "submit", "button"].indexOf(t) >= 0) return t;
      return "textbox";
    }
    return "generic";
  }

  const previous = document.querySelectorAll("[data-antelope-ref]");
  for (let i = 0; i < previous.length; i++) previous[i].removeAttribute("data-antelope-ref");

  const out = [];
  const all = document.querySelectorAll(SELECTOR);
  let index = 0;
  for (let i = 0; i < all.length && index < 120; i++) {
    const el = all[i];
    if (!visible(el)) continue;
    const ref = "e" + (++index);
    el.setAttribute("data-antelope-ref", ref);
    out.push({
      ref: ref,
      role: role(el),
      name: label(el),
      value: "value" in el ? String(el.value == null ? "" : el.value).slice(0, 80) : undefined,
      type: el.type,
      disabled: "disabled" in el ? Boolean(el.disabled) : false
    });
  }
  return { elements: out, text: (document.body ? document.body.innerText : "").slice(0, 3000) };
})()`;

/** 상호작용 가능한 요소만 골라 ref 를 심고 목록으로 돌려준다. */
export async function snapshot(page: Page): Promise<Snapshot> {
  const result = (await page.evaluate(SNAPSHOT_SCRIPT)) as {
    elements: ElementRef[];
    text: string;
  };

  return {
    url: page.url(),
    title: await page.title(),
    elements: result.elements,
    text: result.text.replace(/\n{3,}/g, "\n\n"),
  };
}

const byRef = (ref: string) => `[data-antelope-ref="${ref}"]`;

export type Action =
  | { type: "goto"; url: string }
  | { type: "click"; ref: string }
  | { type: "fill"; ref: string; value: string }
  | { type: "select"; ref: string; value: string }
  | { type: "check"; ref: string }
  | { type: "press"; key: string }
  | { type: "back" };

export async function act(page: Page, action: Action): Promise<string> {
  switch (action.type) {
    case "goto":
      await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return `${action.url} 로 이동했다.`;
    case "click":
      await page.click(byRef(action.ref), { timeout: 10_000 });
      return `${action.ref} 를 클릭했다.`;
    case "fill":
      await page.fill(byRef(action.ref), action.value, { timeout: 10_000 });
      return `${action.ref} 에 "${action.value}" 를 입력했다.`;
    case "select":
      await page.selectOption(
        byRef(action.ref),
        { label: action.value },
        { timeout: 10_000 },
      );
      return `${action.ref} 에서 "${action.value}" 를 선택했다.`;
    case "check":
      await page.check(byRef(action.ref), { timeout: 10_000 });
      return `${action.ref} 를 체크했다.`;
    case "press":
      await page.keyboard.press(action.key);
      return `${action.key} 키를 눌렀다.`;
    case "back":
      await page.goBack({ waitUntil: "domcontentloaded" });
      return "뒤로 갔다.";
  }
}

/** 조작 후 페이지가 안정될 때까지 짧게 기다린다. 실패해도 진행한다. */
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
}
