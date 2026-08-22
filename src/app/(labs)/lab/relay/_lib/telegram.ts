import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

import type { Incoming, IncomingFile, RelayChannel, ThreadRef } from "./channel";
import { appUrl } from "./site";

/**
 * 텔레그램 어댑터.
 *
 * 슬랙과 같은 이유로 SDK 를 쓰지 않는다 — Bot API 는 전부 `POST` + JSON 이라
 * `fetch` 로 충분하고, 의존성을 늘리면 `Dockerfile` 과 standalone 트레이싱을
 * 건드릴 이유가 생긴다.
 *
 * 슬랙과 다른 곳은 셋뿐이고 **전부 이 파일 안에서 끝난다**:
 *
 *   스레드   네이티브 스레드가 없다. `chat_id` + 대화를 연 `message_id` 를
 *            스레드 키로 삼고, 답장은 `reply_to_message_id` 로 잇는다.
 *   검증     서명이 아니라 `setWebhook` 에 등록한 `secret_token` 을 헤더로
 *            되돌려준다. 상수시간으로 비교한다.
 *   멘션     `<@U…>` 같은 표기가 없다. 답장이 그 역할을 한다.
 *
 * 설계: docs/superpowers/plans/2026-08-22-relay-channels.md §3.4 · Step 4
 */

const API = "https://api.telegram.org";

/** 텔레그램 메시지 상한은 4096자다. 여유를 둔다 */
const MAX_TEXT = 3_800;

/** 딥링크 토큰이 사는 시간. 설정 화면에서 눌러 텔레그램으로 건너가는 데 충분하다 */
const LINK_TTL_MS = 10 * 60 * 1000;

/**
 * ⚠ 텔레그램 `/start` 페이로드는 **64자 · `A-Za-z0-9_-`** 뿐이다.
 * 이걸 넘으면 링크가 그냥 안 열린다 — 오류가 아니라 조용한 실패다.
 */
const MAX_START_PAYLOAD = 64;

function token(): string {
  return env.TELEGRAM_BOT_TOKEN ?? "";
}

function linkSecret(): string {
  return env.BETTER_AUTH_SECRET ?? "dev-only-insecure-secret-change-me";
}

/**
 * ⚠ 텔레그램도 실패를 **200 + `{ok:false}`** 로 준다. 슬랙과 같은 함정이다 —
 * HTTP 상태만 보면 아무것도 안 보내진 상태를 성공으로 읽는다.
 */
async function call<T = Record<string, unknown>>(
  method: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  try {
    const response = await fetch(`${API}/bot${token()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
      result?: T;
    };
    if (!data.ok) {
      console.error(`[relay/telegram] ${method} 실패: ${data.description ?? "unknown"}`);
      return null;
    }
    return (data.result ?? null) as T | null;
  } catch (error) {
    console.error(`[relay/telegram] ${method} 예외`, error);
    return null;
  }
}

// ───────────────────────────── 계정 연결 딥링크 ─────────────────────────────

/**
 * 「텔레그램 연결」 버튼이 여는 주소를 만든다.
 *
 * 슬랙은 OIDC 동의 화면이 있지만 텔레그램에는 없다. 대신 **서명한 토큰을
 * 딥링크에 실어** 보낸다 — 사용자가 링크를 누르면 텔레그램이 열리고, [시작]
 * 을 누르면 봇이 `/start <토큰>` 을 받는다. 코드를 손으로 옮기지 않아도 되고
 * BotFather 에 도메인을 등록하지 않아도 된다.
 *
 * 토큰은 그 자체로 **계정에 텔레그램 id 를 붙이는 열쇠**다. 그래서 서명하고,
 * 10분만 살고, 발급은 로그인한 사람만 할 수 있는 `/app/*` 아래에서만 한다.
 */
export function signLinkToken(userId: string): string {
  const payload = Buffer.concat([Buffer.from(userId, "utf8"), stamp(Date.now())]);
  const mac = createHmac("sha256", linkSecret()).update(payload).digest().subarray(0, 8);
  return Buffer.concat([payload, mac]).toString("base64url");
}

export function verifyLinkToken(raw: string): string | null {
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64url");
  } catch {
    return null;
  }
  // userId 1바이트 + 타임스탬프 4 + mac 8 이 최소다.
  if (buf.length < 13) return null;

  const payload = buf.subarray(0, buf.length - 8);
  const mac = buf.subarray(buf.length - 8);
  const expected = createHmac("sha256", linkSecret())
    .update(payload)
    .digest()
    .subarray(0, 8);
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;

  const issuedAt = payload.readUInt32BE(payload.length - 4) * 1000;
  if (Date.now() - issuedAt > LINK_TTL_MS) return null;

  return payload.subarray(0, payload.length - 4).toString("utf8") || null;
}

/** 유닉스 초를 4바이트로. 2106년까지 쓴다 */
function stamp(ms: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(Math.floor(ms / 1000));
  return out;
}

/**
 * 봇 사용자명. 딥링크 주소에 필요하다.
 *
 * env 로 하나 더 받는 대신 `getMe` 로 물어보고 프로세스 안에 캐시한다 —
 * 사람이 손으로 맞춰야 하는 값이 하나 줄고, 봇을 바꿔도 저절로 따라간다.
 */
let cachedUsername: string | null = null;
export async function botUsername(): Promise<string | null> {
  if (cachedUsername) return cachedUsername;
  const me = await call<{ username?: string }>("getMe", {});
  cachedUsername = me?.username ?? null;
  return cachedUsername;
}

/** 설정 화면이 여는 주소. 봇 사용자명을 못 얻으면 null */
export async function linkUrl(userId: string): Promise<string | null> {
  const username = await botUsername();
  if (!username) return null;
  const payload = signLinkToken(userId);
  if (payload.length > MAX_START_PAYLOAD) {
    // 조용히 안 열리는 링크를 주느니 여기서 드러낸다.
    console.error(
      `[relay/telegram] start 페이로드가 ${payload.length}자로 64자를 넘었다 — 연결 링크를 만들 수 없다`,
    );
    return null;
  }
  return `https://t.me/${username}?start=${payload}`;
}

// ───────────────────────────────── 수신 ─────────────────────────────────

type TgUser = { id?: number; is_bot?: boolean; first_name?: string; username?: string };
type TgDoc = {
  file_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};
type TgPhoto = { file_id?: string; file_size?: number; width?: number };

type TgMessage = {
  message_id?: number;
  from?: TgUser;
  chat?: { id?: number; type?: string };
  date?: number;
  text?: string;
  caption?: string;
  document?: TgDoc;
  photo?: TgPhoto[];
  reply_to_message?: { message_id?: number };
};

type TgUpdate = {
  update_id?: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  channel_post?: TgMessage;
};

/**
 * 첨부를 내려받을 수 있는 모양으로 바꾼다.
 *
 * ⚠ 두 걸음이다. `getFile` 로 경로를 받고, 그 경로를 파일 호스트에 붙여야
 * 실제 바이트가 온다. 봇 토큰이 **주소 안에** 들어가므로 이 URL 은 로그에
 * 남기지 않는다.
 */
function toFiles(message: TgMessage): IncomingFile[] {
  const out: IncomingFile[] = [];

  const push = (fileId: string, name: string, mime: string, bytes: number) => {
    out.push({
      name,
      mime,
      bytes,
      download: async () => {
        const file = await call<{ file_path?: string }>("getFile", { file_id: fileId });
        if (!file?.file_path) throw new Error("텔레그램 getFile 실패");
        const response = await fetch(`${API}/file/bot${token()}/${file.file_path}`);
        if (!response.ok) {
          throw new Error(`텔레그램 파일 다운로드 실패 ${response.status}`);
        }
        return response.blob();
      },
    });
  };

  if (message.document?.file_id) {
    push(
      message.document.file_id,
      message.document.file_name ?? "첨부파일",
      message.document.mime_type ?? "application/octet-stream",
      message.document.file_size ?? 0,
    );
  }

  /**
   * 사진은 해상도별로 여러 벌이 온다. **가장 큰 것만** 쓴다 — 공고문을 찍어
   * 보내는 경우가 있어서 작은 썸네일을 고르면 OCR 이 못 읽는다.
   */
  if (Array.isArray(message.photo) && message.photo.length > 0) {
    const largest = [...message.photo].sort(
      (a, b) => (b.file_size ?? b.width ?? 0) - (a.file_size ?? a.width ?? 0),
    )[0];
    if (largest?.file_id) {
      push(largest.file_id, "사진.jpg", "image/jpeg", largest.file_size ?? 0);
    }
  }

  return out;
}

export const telegram: RelayChannel = {
  id: "telegram",

  ready() {
    return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET);
  },

  /**
   * 서명이 아니라 **되돌려받는 비밀값**이다.
   *
   * `setWebhook` 에 `secret_token` 을 등록해 두면 텔레그램이 매 요청의
   * `X-Telegram-Bot-Api-Secret-Token` 헤더에 그 값을 그대로 실어 준다.
   * 이 값은 **빌드마다 새로 만들면 안 된다** — 등록해 둔 값과 달라지는 순간
   * 모든 웹훅이 401 이 되고, 증상은 「봇이 아무 반응이 없다」로만 나타난다.
   *
   * `rawBody` 는 쓰지 않는다. 계약을 맞추기 위해 받기만 한다.
   */
  verify(req) {
    const expected = env.TELEGRAM_WEBHOOK_SECRET;
    if (!expected) return false;
    const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    // ⚠ 길이가 다르면 timingSafeEqual 이 던진다. 먼저 본다.
    return a.length === b.length && timingSafeEqual(a, b);
  },

  parse(rawBody) {
    let update: TgUpdate;
    try {
      update = JSON.parse(rawBody) as TgUpdate;
    } catch {
      return { kind: "ignore", why: "JSON 이 아니다" };
    }

    // 편집은 새 글이 아니다. 채널 게시물도 다루지 않는다.
    if (update.edited_message) return { kind: "ignore", why: "편집된 메시지" };
    if (update.channel_post) return { kind: "ignore", why: "채널 게시물" };

    const message = update.message;
    if (!message) return { kind: "ignore", why: "message 가 없다" };
    if (message.from?.is_bot) return { kind: "ignore", why: "봇 메시지" };

    const chatId = message.chat?.id;
    const fromId = message.from?.id;
    if (
      chatId === undefined ||
      fromId === undefined ||
      message.message_id === undefined
    ) {
      return { kind: "ignore", why: "chat·from·message_id 가 없다" };
    }

    const text = (message.text ?? message.caption ?? "").trim();
    const files = toFiles(message);
    if (!text && files.length === 0) {
      return { kind: "ignore", why: "본문도 첨부도 없다" };
    }

    const isDirect = message.chat?.type === "private";

    /**
     * 스레드가 없으므로 만들어 쓴다.
     *
     * 답장이면 **답장 대상**을 뿌리로 본다. 아니면 이 글이 뿌리다. 슬랙의
     * `thread_ts ?? ts` 와 같은 규칙이고, 그래서 `host.ts` 가 두 채널을
     * 구분하지 않아도 된다.
     */
    const ref: ThreadRef = {
      channel: "telegram",
      conversation: String(chatId),
      thread: String(message.reply_to_message?.message_id ?? message.message_id),
      // 텔레그램에는 워크스페이스 개념이 없다.
      workspaceId: null,
    };

    const incoming: Incoming = {
      ref,
      from: String(fromId),
      displayName: message.from?.username
        ? `@${message.from.username}`
        : (message.from?.first_name ?? null),
      text,
      files,
      // 멱등 키. 텔레그램은 200 을 못 받으면 같은 update_id 로 다시 보낸다.
      eventId: `tg-${update.update_id ?? `${chatId}-${message.message_id}`}`,
      isDirect,
    };
    return { kind: "message", incoming };
  },

  async post(ref, text) {
    const result = await call<{ message_id?: number }>("sendMessage", {
      chat_id: ref.conversation,
      text: text.slice(0, MAX_TEXT),
      reply_to_message_id: Number(ref.thread),
      /**
       * 답장 대상이 지워졌으면 그냥 새 글로 보낸다. 이게 없으면 텔레그램이
       * 400 을 주고 그 스레드의 진행 보고가 통째로 사라진다.
       */
      allow_sending_without_reply: true,
      // 마크다운을 켜면 우리 본문의 `*`·`_` 하나에 전체가 400 으로 죽는다.
      disable_web_page_preview: true,
    });
    return result?.message_id !== undefined ? String(result.message_id) : null;
  },

  async edit(ref, messageId, text) {
    await call("editMessageText", {
      chat_id: ref.conversation,
      message_id: Number(messageId),
      text: text.slice(0, MAX_TEXT),
      disable_web_page_preview: true,
    });
  },

  /** 멘션 표기가 없다. 답장이 그 역할을 하므로 빈 문자열이다 */
  mention() {
    return "";
  },

  linkHint() {
    return [
      "이 텔레그램 계정이 아직 Antelope 에 연결되어 있지 않습니다.",
      `${appUrl("/app/settings")} 에서 「텔레그램 연결」을 한 번 누르면 됩니다.`,
    ].join("\n");
  },
};
