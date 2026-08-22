import type { Page } from "playwright";

/**
 * 캡챠가 있는가.
 *
 * 이 판단 하나로 신청을 어느 브라우저로 돌릴지 갈린다.
 *
 *   없다 → Playwright. DOM 을 직접 보니 빠르고 정확하다.
 *   있다 → Xvfb + xdotool. 느리고 화면으로만 읽지만, X 서버로 직접 들어가므로
 *          **캡챠 iframe 안도 사람이 그대로 조작할 수 있다.** CDP 로는 못 한다.
 *
 * 그래서 탐지는 놓치는 쪽(거짓 음성)이 훨씬 비싸다. 놓치면 자동 모드가 캡챠 앞에서
 * 헛돌다 끝나고 사람은 손댈 방법이 없다. 반대로 잘못 잡으면 느린 길로 갈 뿐이다.
 * 그래서 넓게 잡는다.
 */

/** 스크립트·iframe 주소로 보는 벤더 */
const VENDOR_URL =
  /recaptcha|hcaptcha|turnstile|cloudflare\.com\/challenge|funcaptcha|arkoselabs|geetest|captcha/i;

/** 사람이 읽는 문구. 자체 구현 캡챠는 이걸로만 잡힌다 */
const VENDOR_TEXT =
  /로봇이 아닙니다|사람입니까|보안\s*문자|자동입력\s*방지|자동\s*등록\s*방지|캡차|캡챠|보안코드 입력|i'?m not a robot|verify you are human|are you a robot|security code below/i;

/** DOM 에 남는 흔적 */
const SELECTORS = [
  "iframe[src*='recaptcha']",
  "iframe[src*='hcaptcha']",
  "iframe[src*='turnstile']",
  "iframe[title*='captcha' i]",
  ".g-recaptcha",
  "#g-recaptcha",
  ".h-captcha",
  ".cf-turnstile",
  "[data-sitekey]",
  "img[src*='captcha' i]",
  "input[name*='captcha' i]",
  "canvas[id*='captcha' i]",
];

export type CaptchaCheck = { found: boolean; reason: string | null };

/**
 * 열려 있는 페이지에서 캡챠를 찾는다.
 *
 * 캡챠는 처음부터 있기도 하고 제출을 누른 뒤에 뜨기도 한다. 그래서 자동 모드는
 * 조작할 때마다 이걸 다시 부른다 — 중간에 나타나면 그 자리에서 수동으로 넘긴다.
 */
export async function findCaptcha(page: Page): Promise<CaptchaCheck> {
  try {
    const hit = await page.evaluate(
      ({ selectors, urlPattern }) => {
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) {
            const rect = (el as HTMLElement).getBoundingClientRect?.();
            // 화면에 없는 껍데기(숨은 recaptcha v3 배지 등)는 사람이 풀 게 없다.
            const visible = !rect || rect.width > 0 || rect.height > 0;
            if (visible) return `요소 ${selector}`;
          }
        }
        const re = new RegExp(urlPattern, "i");
        for (const node of document.querySelectorAll("script[src], iframe[src]")) {
          const src = node.getAttribute("src") ?? "";
          if (re.test(src)) return `리소스 ${src.slice(0, 120)}`;
        }
        return null;
      },
      { selectors: SELECTORS, urlPattern: VENDOR_URL.source },
    );
    if (hit) return { found: true, reason: hit };

    const text = await page.evaluate(() => document.body?.innerText ?? "");
    const matched = text.match(VENDOR_TEXT);
    if (matched) return { found: true, reason: `문구 「${matched[0]}」` };

    return { found: false, reason: null };
  } catch {
    // 페이지가 넘어가는 중이면 평가가 실패한다. 없다고 단정하지 않고 넘어간다.
    return { found: false, reason: null };
  }
}

/** OCR 로 읽은 화면 글자에서 찾는다. 수동 모드는 DOM 이 없다 */
export function looksLikeCaptchaText(text: string): boolean {
  return VENDOR_TEXT.test(text) || /captcha/i.test(text);
}
