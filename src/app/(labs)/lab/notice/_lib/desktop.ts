import { execFile, spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { LiveInput } from "./types";

const run = promisify(execFile);

/**
 * 에이전트가 쓰는 브라우저 레이어 — CDP 없이.
 *
 * Xvfb 위에 **일반 Chromium 프로세스**를 띄우고 xdotool 로 마우스·키보드를 흔든다.
 * 원격 디버깅 포트를 열지 않으므로 `navigator.webdriver` 도, CDP `Runtime.enable`
 * 흔적도 없다. 페이지 입장에서는 사람이 앉아 있는 데스크톱과 구별할 수 없다.
 *
 * 대가도 분명하다 — DOM 이 없다. URL 도, 요소 목록도 직접 읽을 수 없다.
 * 화면은 스크린샷으로만 보고(ocr.ts), 페이지 전환은 창 제목과 화면 변화율로
 * 추정한다. 그래서 이 파일의 함수들은 전부 "보이는 것" 기준으로 동작한다.
 */

export const SCREEN = { width: 1280, height: 900 } as const;

type Session = {
  id: string;
  display: string;
  xvfb: ChildProcess;
  chromium: ChildProcess;
  profileDir: string;
  createdAt: number;
  /** 사람이 조작하는 동안 에이전트를 멈춘다 */
  held: boolean;
  /** 라이브 뷰 구독자. 있을 때만 캡처 루프가 돈다 */
  live: Set<(jpeg: Buffer) => void>;
  liveLoop: NodeJS.Timeout | null;
  /** 직전 화면 변화 판정용 소형 래스터 */
  lastThumb: Buffer | null;
};

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 15 * 60 * 1000;
let nextDisplay = 100;

function sweep() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) void closeSession(id);
  }
}

function envFor(display: string) {
  return { ...process.env, DISPLAY: display };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 세션을 연다. 이미 있으면 그대로 돌려준다.
 *
 * Chromium 은 kiosk 로 띄운다 — 주소창·탭이 없어야 페이지 좌표 = 화면 좌표가
 * 되고, OCR 이 읽은 글자 위치를 그대로 클릭할 수 있다.
 */
export async function openSession(
  id: string,
  startUrl = "about:blank",
): Promise<Session> {
  sweep();
  const existing = sessions.get(id);
  if (existing) return existing;

  const display = `:${nextDisplay++}`;
  const xvfb = spawn(
    "Xvfb",
    [
      display,
      "-screen",
      "0",
      `${SCREEN.width}x${SCREEN.height}x24`,
      "-nolisten",
      "tcp",
      "-ac",
    ],
    { stdio: "ignore" },
  );
  await waitForDisplay(display);

  const profileDir = await mkdtemp(join(tmpdir(), "antelope-chromium-"));
  // 바이너리 이름은 리터럴이어야 한다. 변수로 넘기면 Turbopack 이 "동적 파일 접근"
  // 으로 보고 프로젝트 전체를 트레이싱한다. Debian 패키지가 PATH 에 `chromium` 을 둔다.
  const chromium = spawn(
    "chromium",
    [
      `--user-data-dir=${profileDir}`,
      `--window-size=${SCREEN.width},${SCREEN.height}`,
      "--window-position=0,0",
      "--kiosk",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-infobars",
      "--disable-session-crashed-bubble",
      "--disable-features=TranslateUI",
      "--force-device-scale-factor=1",
      "--lang=ko-KR",
      // 컨테이너 안에서는 user namespace 가 막혀 있어 샌드박스가 못 뜬다.
      // 이 플래그는 페이지에서 감지되지 않는다 — 프로세스 격리 얘기지 지문이 아니다.
      "--no-sandbox",
      "--disable-dev-shm-usage",
      startUrl,
    ],
    { env: envFor(display), stdio: "ignore" },
  );

  const session: Session = {
    id,
    display,
    xvfb,
    chromium,
    profileDir,
    createdAt: Date.now(),
    held: false,
    live: new Set(),
    liveLoop: null,
    lastThumb: null,
  };
  sessions.set(id, session);

  await waitForWindow(display);
  return session;
}

export async function closeSession(id: string) {
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  if (session.liveLoop) clearInterval(session.liveLoop);
  session.chromium.kill("SIGTERM");
  await sleep(300);
  session.chromium.kill("SIGKILL");
  session.xvfb.kill("SIGKILL");
  await rm(session.profileDir, { recursive: true, force: true }).catch(() => {});
}

export function hasSession(id: string) {
  return sessions.has(id);
}

/**
 * 세션이 생길 때까지 기다린다.
 *
 * 라이브 뷰는 사용자가 먼저 열고, 브라우저 에이전트는 파이프라인 2단계에서야
 * 세션을 만든다. 그 사이를 메우지 않으면 화면이 영영 비어 있다.
 */
export async function waitForSession(id: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const session = sessions.get(id);
    if (session) return session;
    await sleep(250);
  }
  return null;
}

async function waitForDisplay(display: string, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await run("xdotool", ["getdisplaygeometry"], { env: envFor(display) });
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error(`Xvfb ${display} 가 뜨지 않았다.`);
}

async function waitForWindow(display: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { stdout } = await run(
        "xdotool",
        ["search", "--onlyvisible", "--class", "chromium"],
        { env: envFor(display) },
      );
      if (stdout.trim()) {
        // 창은 떴지만 첫 페인트까지 잠깐 더 걸린다
        await sleep(400);
        return;
      }
    } catch {
      /* 아직 없음 */
    }
    await sleep(150);
  }
  throw new Error("Chromium 창이 뜨지 않았다.");
}

/* ------------------------------------------------------------------ */
/* 보기                                                                 */
/* ------------------------------------------------------------------ */

/** 현재 화면 전체를 JPEG 로 뜬다. */
export async function screenshot(id: string, quality = 60): Promise<Buffer> {
  const session = must(id);
  const { stdout } = await run(
    "import",
    [
      "-display",
      session.display,
      "-window",
      "root",
      "-quality",
      String(quality),
      "jpeg:-",
    ],
    { env: envFor(session.display), encoding: "buffer", maxBuffer: 16 * 1024 * 1024 },
  );
  return stdout as unknown as Buffer;
}

/** OCR 용 무손실 PNG. JPEG 블록 노이즈가 글자 인식을 망친다. */
export async function screenshotPng(id: string): Promise<Buffer> {
  const session = must(id);
  const { stdout } = await run(
    "import",
    ["-display", session.display, "-window", "root", "png:-"],
    { env: envFor(session.display), encoding: "buffer", maxBuffer: 32 * 1024 * 1024 },
  );
  return stdout as unknown as Buffer;
}

/**
 * 화면이 얼마나 바뀌었는지 0~1 로 돌려준다.
 *
 * CDP 가 없으니 `page.url()` 로 전환을 알 수 없다. 대신 128×90 으로 줄인
 * 래스터를 직전 것과 비교한다 — 캐럿 깜빡임은 한 픽셀도 안 되고, 페이지 전환은
 * 절반 이상이 바뀐다. 제출 버튼을 눌렀는데 0.02 면 검증 실패로 봐도 된다.
 */
export async function changeRatio(id: string): Promise<number> {
  const session = must(id);
  const { stdout } = await run(
    "import",
    [
      "-display",
      session.display,
      "-window",
      "root",
      "-resize",
      "128x90!",
      "-depth",
      "8",
      "rgb:-",
    ],
    { env: envFor(session.display), encoding: "buffer", maxBuffer: 4 * 1024 * 1024 },
  );
  const thumb = stdout as unknown as Buffer;
  const prev = session.lastThumb;
  session.lastThumb = thumb;
  if (!prev || prev.length !== thumb.length) return 1;

  let changed = 0;
  const pixels = thumb.length / 3;
  for (let i = 0; i < thumb.length; i += 3) {
    const d =
      Math.abs(prev[i] - thumb[i]) +
      Math.abs(prev[i + 1] - thumb[i + 1]) +
      Math.abs(prev[i + 2] - thumb[i + 2]);
    if (d > 48) changed++;
  }
  return changed / pixels;
}

/** 창 제목. kiosk 에서는 페이지 <title> 이 그대로 온다. */
export async function title(id: string): Promise<string> {
  const session = must(id);
  try {
    const { stdout } = await run(
      "xdotool",
      ["search", "--onlyvisible", "--class", "chromium", "getwindowname", "%1"],
      { env: envFor(session.display) },
    );
    return stdout.trim().replace(/ - Chromium$/, "");
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* 조작                                                                 */
/* ------------------------------------------------------------------ */

const isAscii = (s: string) => /^[\x20-\x7e\n\t]*$/.test(s);

/**
 * 텍스트 입력.
 *
 * ASCII 는 xdotool type 으로 한 글자씩 친다(키 이벤트가 그대로 남아 가장 자연스럽다).
 * 한글은 키심 매핑이 불안정해서 클립보드에 넣고 Ctrl+V 로 붙인다.
 */
export async function typeText(id: string, text: string) {
  const session = must(id);
  const env = envFor(session.display);
  if (isAscii(text)) {
    await run("xdotool", ["type", "--delay", "25", "--clearmodifiers", "--", text], {
      env,
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const clip = spawn("xclip", ["-selection", "clipboard", "-in"], {
      env,
      stdio: ["pipe", "ignore", "ignore"],
    });
    clip.on("error", reject);
    clip.on("close", () => resolve());
    clip.stdin.end(text);
  });
  await run("xdotool", ["key", "--clearmodifiers", "ctrl+v"], { env });
}

export async function input(id: string, action: LiveInput) {
  const session = must(id);
  const env = envFor(session.display);
  const at = (x: number, y: number) => [String(Math.round(x)), String(Math.round(y))];

  switch (action.kind) {
    case "move":
      await run("xdotool", ["mousemove", ...at(action.x, action.y)], { env });
      return;
    case "click":
      await run("xdotool", ["mousemove", ...at(action.x, action.y), "click", "1"], {
        env,
      });
      return;
    case "dblclick":
      await run(
        "xdotool",
        ["mousemove", ...at(action.x, action.y), "click", "--repeat", "2", "1"],
        { env },
      );
      return;
    case "drag":
      await run("xdotool", ["mousemove", ...at(action.x, action.y), "mousedown", "1"], {
        env,
      });
      await run("xdotool", ["mousemove_relative", "--sync", "--", "1", "1"], {
        env,
      }).catch(() => {});
      await run(
        "xdotool",
        ["mousemove", "--sync", ...at(action.toX, action.toY), "mouseup", "1"],
        { env },
      );
      return;
    case "scroll": {
      await run("xdotool", ["mousemove", ...at(action.x, action.y)], { env });
      const button = action.dy > 0 ? "5" : "4";
      const clicks = Math.min(10, Math.max(1, Math.round(Math.abs(action.dy) / 100)));
      await run(
        "xdotool",
        ["click", "--repeat", String(clicks), "--delay", "20", button],
        { env },
      );
      return;
    }
    case "type":
      await typeText(id, action.text);
      return;
    case "key":
      await run("xdotool", ["key", "--clearmodifiers", action.key], { env });
      return;
  }
}

/** 조작 직후 렌더가 안정될 때까지. 화면이 더 안 바뀌면 일찍 끝난다. */
export async function settle(id: string, maxMs = 2_500) {
  const deadline = Date.now() + maxMs;
  await sleep(250);
  while (Date.now() < deadline) {
    const ratio = await changeRatio(id);
    if (ratio < 0.002) return;
    await sleep(250);
  }
}

/* ------------------------------------------------------------------ */
/* 사람에게 넘기기                                                       */
/* ------------------------------------------------------------------ */

export function setHold(id: string, held: boolean) {
  const session = sessions.get(id);
  if (session) session.held = held;
}

export function isHeld(id: string) {
  return sessions.get(id)?.held ?? false;
}

/** 에이전트가 다음 조작 전에 부른다. 사람이 놓아줄 때까지 기다린다. */
export async function waitWhileHeld(id: string, timeoutMs = 10 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs;
  while (isHeld(id) && Date.now() < deadline) await sleep(300);
}

/**
 * 라이브 뷰 구독. 구독자가 있는 동안만 5fps 로 캡처하고, 화면이 바뀐 프레임만 보낸다.
 * 정지 화면에서는 트래픽이 0 에 가깝다.
 */
export async function subscribeLive(
  id: string,
  onFrame: (jpeg: Buffer) => void,
): Promise<() => void> {
  const session = await waitForSession(id);
  if (!session) throw new Error("세션을 찾을 수 없습니다.");
  session.live.add(onFrame);

  if (!session.liveLoop) {
    let busy = false;
    let lastHash = "";
    session.liveLoop = setInterval(async () => {
      if (busy || session.live.size === 0) return;
      busy = true;
      try {
        const jpeg = await screenshot(id, 55);
        // 같은 화면은 다시 보내지 않는다. 길이+샘플 몇 바이트면 충분하다
        const hash = `${jpeg.length}:${jpeg.subarray(1000, 1032).toString("hex")}`;
        if (hash !== lastHash) {
          lastHash = hash;
          for (const listener of session.live) listener(jpeg);
        }
      } catch {
        /* 세션이 닫히는 중일 수 있다 */
      } finally {
        busy = false;
      }
    }, 200);
  }

  return () => {
    session.live.delete(onFrame);
    if (session.live.size === 0 && session.liveLoop) {
      clearInterval(session.liveLoop);
      session.liveLoop = null;
    }
  };
}

function must(id: string): Session {
  const session = sessions.get(id);
  if (!session) throw new Error(`세션 ${id} 이 없다.`);
  return session;
}
