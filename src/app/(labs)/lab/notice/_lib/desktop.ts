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
/**
 * 동시에 띄울 수 있는 데스크톱 수.
 *
 * Xvfb + Chromium 한 벌이 수백 MB 를 쓴다. 상한이 없으면 동시 신청 두어 건에
 * 컨테이너가 OOM 으로 죽는데, 그때 죽는 건 그 세션이 아니라 **서버 전체**다.
 * 거절이 전체 장애보다 낫다.
 */
const MAX_SESSIONS = 2;
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
  if (sessions.size >= MAX_SESSIONS) {
    throw new Error(
      `브라우저 세션이 이미 ${sessions.size}개 떠 있습니다. 진행 중인 신청이 끝난 뒤 다시 시도하세요.`,
    );
  }

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
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const xvfbLog = tapStderr(xvfb);
  await waitForDisplay(display, 8_000, xvfbLog);

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
      "--disable-features=Translate,TranslateUI",
      "--disable-translate",
      "--force-device-scale-factor=1",
      "--lang=ko-KR",
      // 컨테이너 안에서는 user namespace 가 막혀 있어 샌드박스가 못 뜬다.
      // 이 플래그는 페이지에서 감지되지 않는다 — 프로세스 격리 얘기지 지문이 아니다.
      "--no-sandbox",
      "--disable-dev-shm-usage",
      // 컨테이너는 GPU 도 없고 메모리도 빠듯하다. 기동 때 하는 일을 줄이면
      // 첫 창이 그만큼 빨리 뜬다 — 여기서 늦어져 타임아웃으로 죽었었다.
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-extensions",
      "--metrics-recording-only",
      "--mute-audio",
      // 렌더러를 하나로 묶는다. 탭마다 프로세스를 띄우면 컨테이너 메모리 한도를
      // 넘고, 그때 커널이 죽이는 건 Chromium 이 아니라 Node 서버일 수 있다.
      "--renderer-process-limit=1",
      "--disable-site-isolation-trials",
      // ⚠ 이게 없으면 컨테이너에서 기동 자체가 막힌다. 크래시 리포터(crashpad)가
      // 쓸 디렉터리를 HOME 에서 유도하는데, 비루트 사용자의 HOME 이 쓰기 불가라
      // `chrome_crashpad_handler: --database is required` 로 주저앉는다.
      // 프로세스는 살아 있고 창만 영영 안 떠서 원인을 찾기가 특히 어렵다.
      "--disable-crash-reporter",
      "--disable-breakpad",
      `--crash-dumps-dir=${profileDir}`,
      startUrl,
    ],
    {
      // HOME 을 프로필 디렉터리로 고정한다. 컨테이너의 비루트 사용자는 HOME 이
      // 없거나 읽기 전용이라, 그대로 두면 Chromium 이 설정·캐시를 쓸 곳을 잃는다.
      env: {
        ...envFor(display),
        HOME: profileDir,
        XDG_CONFIG_HOME: profileDir,
        XDG_CACHE_HOME: profileDir,
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  const chromiumLog = tapStderr(chromium);

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

  try {
    await waitForWindow(display, 45_000, chromium, chromiumLog);
  } catch (error) {
    // 실패한 세션을 남겨두면 다음 요청이 죽은 세션을 그대로 물려받는다.
    await closeSession(id);
    throw error;
  }
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

/**
 * 자식 프로세스의 stderr 를 붙잡아 둔다.
 *
 * 예전에는 `stdio: "ignore"` 였다. 그래서 「Chromium 창이 뜨지 않았다」만 남고
 * 왜 안 떴는지는 영영 알 수 없었다 — 바이너리가 없는 건지, 메모리가 모자란
 * 건지, 샌드박스에 막힌 건지 구분이 안 된다. 마지막 2KB 만 들고 있으면 된다.
 */
function tapStderr(child: ChildProcess): () => string {
  let buffer = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    buffer = (buffer + chunk.toString("utf8")).slice(-2048);
  });
  // ⚠ 리스너가 없으면 spawn 실패(ENOENT 등)가 **처리되지 않은 error 이벤트**가
  // 되어 Node 프로세스를 통째로 죽인다. 브라우저 하나 못 띄운 일로 서버가
  // 내려가서는 안 된다. 여기서 붙잡아 진단 문구로만 남긴다.
  child.on("error", (error) => {
    buffer = (buffer + `\nspawn 실패: ${error.message}`).slice(-2048);
  });
  return () => buffer.trim();
}

/** spawn 이 아예 실패했는지. exitCode 는 null 이라 이걸로 따로 본다 */
function spawnFailed(child: ChildProcess): boolean {
  return child.pid === undefined;
}

async function waitForDisplay(display: string, timeoutMs = 8_000, log?: () => string) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await run("xdotool", ["getdisplaygeometry"], { env: envFor(display) });
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error(`Xvfb ${display} 가 뜨지 않았다.${detail(log?.())}`);
}

/**
 * Chromium 창을 기다린다.
 *
 * 프로세스가 먼저 죽으면 기다릴 이유가 없다 — 타임아웃을 다 쓰고 나서 엉뚱한
 * 말을 하는 대신 종료 코드와 stderr 를 그대로 올린다. 컨테이너 첫 기동은
 * 페이지 캐시가 차갑고 메모리도 빠듯해 15초로는 모자랐다.
 */
async function waitForWindow(
  display: string,
  timeoutMs = 45_000,
  child?: ChildProcess,
  log?: () => string,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && spawnFailed(child)) {
      throw new Error(`Chromium 을 실행하지 못했다.${detail(log?.())}`);
    }
    if (child && child.exitCode !== null) {
      throw new Error(
        `Chromium 이 시작하자마자 종료했다 (code ${child.exitCode}).${detail(log?.())}`,
      );
    }
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
  throw new Error(
    `Chromium 창이 ${Math.round(timeoutMs / 1000)}초 안에 뜨지 않았다.${detail(log?.())}`,
  );
}

function detail(stderr: string | undefined): string {
  if (!stderr) return " (stderr 없음 — 바이너리 자체가 없거나 즉시 죽었을 수 있다)";
  return `\nstderr: ${stderr.slice(-600)}`;
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
