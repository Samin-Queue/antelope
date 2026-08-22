import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

import type { Incoming, IncomingFile, RelayChannel, ThreadRef } from "./channel";
import { appUrl } from "./site";

/**
 * 슬랙 어댑터.
 *
 * `@slack/web-api` 를 쓰지 않는다. 슬랙 Web API 는 전부 `POST` + JSON 이라
 * `fetch` 로 충분하고, 의존성을 늘리면 `Dockerfile` 과 standalone 트레이싱을
 * 건드릴 이유가 생긴다 — AGENTS.md 「지우면 안 되는 것들」의 첫 두 줄이
 * 정확히 그 영역이다.
 */

const API = "https://slack.com/api";

/** 서명 타임스탬프 허용 폭. 재전송 공격을 막는다 */
const SKEW_MS = 5 * 60 * 1000;

/** 슬랙 메시지 상한은 훨씬 크지만, 스레드에서 읽히는 길이는 이 정도다 */
const MAX_TEXT = 3_800;

function token(): string {
  return env.SLACK_BOT_TOKEN ?? "";
}

/**
 * ⚠ 슬랙은 실패를 **200 + `{ok:false}`** 로 준다.
 *
 * HTTP 상태만 보면 스코프가 없어 아무것도 안 보내진 상태를 성공으로 읽는다.
 * 진행 상황이 스레드에 안 뜨는데 서버 로그는 조용한 증상이 여기서 나온다.
 *
 * ⚠ 본문은 **form-urlencoded** 로 보낸다. JSON 본문은 일부 메서드만 받고
 * 어느 메서드가 그런지는 메서드 문서마다 다르다 — 최대공약수가 form 이다.
 * 중첩 값(blocks 등)이 필요해지면 그 필드만 JSON 문자열로 넣는다.
 */
async function call<T = Record<string, unknown>>(
  method: string,
  body: Record<string, unknown>,
): Promise<(T & { ok: true }) | null> {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    form.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  try {
    const response = await fetch(`${API}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        Authorization: `Bearer ${token()}`,
      },
      body: form,
    });
    const data = (await response.json()) as { ok: boolean; error?: string } & T;
    if (!data.ok) {
      console.error(`[relay/slack] ${method} 실패: ${data.error ?? "unknown"}`);
      return null;
    }
    return data as T & { ok: true };
  } catch (error) {
    console.error(`[relay/slack] ${method} 예외`, error);
    return null;
  }
}

/**
 * 슬랙 표기를 평문으로 되돌린다.
 *
 * **이걸 빼면 링크 입력이 통째로 죽는다.** 사용자가 주소를 붙여 넣으면 슬랙이
 * `<https://example.com|example.com>` 로 감싸 보내는데, 그대로 넘기면
 * `run/route.ts:38` 의 `^https?://` 검사에 걸리지 않는다.
 */
export function unwrapSlack(text: string): string {
  return text
    .replace(/<@[UW][A-Z0-9]+(\|[^>]*)?>/g, " ") // 멘션 — 봇 자신 포함
    .replace(/<#[A-Z0-9]+\|([^>]*)>/g, "#$1") // 채널
    .replace(/<(https?:\/\/[^|>]+)\|[^>]*>/g, "$1") // 라벨 붙은 링크 → URL
    .replace(/<(https?:\/\/[^>]+)>/g, "$1") // 맨 링크
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .trim();
}

type SlackFile = {
  id?: string;
  name?: string;
  mimetype?: string;
  size?: number;
  url_private_download?: string;
  url_private?: string;
};

function toFiles(files: SlackFile[] | undefined): IncomingFile[] {
  if (!Array.isArray(files)) return [];
  return files
    .filter((file) => file.url_private_download || file.url_private)
    .map((file) => {
      const url = (file.url_private_download ?? file.url_private) as string;
      return {
        name: file.name ?? "첨부파일",
        mime: file.mimetype ?? "application/octet-stream",
        bytes: file.size ?? 0,
        /**
         * ⚠ 봇 토큰을 `Authorization` 으로 보내야 받아진다(`files:read` 필요).
         * 토큰 없이 열면 슬랙이 **로그인 HTML 을 200 으로** 돌려주므로,
         * 응답 코드만 보면 성공처럼 보이고 파싱 단계에서 엉뚱하게 터진다.
         */
        download: async () => {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token()}` },
          });
          if (!response.ok) throw new Error(`슬랙 파일 다운로드 실패 ${response.status}`);
          const type = response.headers.get("content-type") ?? "";
          if (type.includes("text/html")) {
            throw new Error(
              "슬랙 파일 다운로드가 로그인 화면으로 돌아왔다 — files:read 확인",
            );
          }
          return response.blob();
        },
      };
    });
}

type SlackEvent = {
  type?: string;
  subtype?: string;
  bot_id?: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  channel?: string;
  channel_type?: string;
  files?: SlackFile[];
};

type SlackEnvelope = {
  type?: string;
  challenge?: string;
  event_id?: string;
  team_id?: string;
  event?: SlackEvent;
};

export const slack: RelayChannel = {
  id: "slack",

  ready() {
    return Boolean(env.SLACK_SIGNING_SECRET && env.SLACK_BOT_TOKEN);
  },

  verify(req, rawBody) {
    const secret = env.SLACK_SIGNING_SECRET;
    if (!secret) return false;

    const timestamp = req.headers.get("x-slack-request-timestamp");
    const signature = req.headers.get("x-slack-signature");
    if (!timestamp || !signature) return false;

    // 오래된 요청은 거절한다. 누가 우리 URL 로 그대로 되쏘는 것을 막는다.
    const age = Math.abs(Date.now() - Number(timestamp) * 1000);
    if (!Number.isFinite(age) || age > SKEW_MS) return false;

    const expected = `v0=${createHmac("sha256", secret)
      .update(`v0:${timestamp}:${rawBody}`)
      .digest("hex")}`;

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    // ⚠ 길이가 다르면 timingSafeEqual 이 던진다. 먼저 본다.
    return a.length === b.length && timingSafeEqual(a, b);
  },

  parse(rawBody) {
    let body: SlackEnvelope;
    try {
      body = JSON.parse(rawBody) as SlackEnvelope;
    } catch {
      return { kind: "ignore", why: "JSON 이 아니다" };
    }

    // Request URL 을 등록할 때 한 번 온다. 돌려주지 않으면 URL 저장이 안 된다.
    if (body.type === "url_verification" && body.challenge) {
      return { kind: "challenge", challenge: body.challenge };
    }
    if (body.type !== "event_callback" || !body.event) {
      return { kind: "ignore", why: `다루지 않는 봉투 ${body.type}` };
    }

    const event = body.event;
    // 봇이 쓴 글에 봇이 반응하면 무한 루프가 된다.
    if (event.bot_id || event.subtype === "bot_message") {
      return { kind: "ignore", why: "봇 메시지" };
    }
    if (!event.user || !event.channel || !event.ts) {
      return { kind: "ignore", why: "발신자·채널·ts 가 없다" };
    }

    const isDirect = event.channel_type === "im" || event.channel.startsWith("D");

    /**
     * DM 에서 봇을 멘션하면 `app_mention` 과 `message` 가 **둘 다** 온다.
     * event_id 가 서로 달라 멱등으로는 안 걸리므로 여기서 한쪽을 버린다 —
     * DM 은 `message`, 채널은 `app_mention` 만 받는다.
     */
    if (event.type === "app_mention" && isDirect) {
      return { kind: "ignore", why: "DM 의 멘션은 message 로 받는다" };
    }
    if (event.type === "message" && !isDirect) {
      return { kind: "ignore", why: "채널 메시지는 멘션으로만 받는다" };
    }
    if (event.type !== "app_mention" && event.type !== "message") {
      return { kind: "ignore", why: `다루지 않는 이벤트 ${event.type}` };
    }
    // 편집·삭제·참여 알림 등. 새 글만 본다.
    if (event.subtype && event.subtype !== "file_share") {
      return { kind: "ignore", why: `subtype ${event.subtype}` };
    }

    const ref: ThreadRef = {
      channel: "slack",
      conversation: event.channel,
      // 스레드 안이면 그 뿌리를, 아니면 이 글이 뿌리가 된다.
      thread: event.thread_ts ?? event.ts,
      workspaceId: body.team_id ?? null,
    };

    const incoming: Incoming = {
      ref,
      from: event.user,
      displayName: null,
      text: unwrapSlack(event.text ?? ""),
      files: toFiles(event.files),
      eventId: body.event_id ?? `${event.channel}-${event.ts}`,
      isDirect,
    };
    return { kind: "message", incoming };
  },

  async post(ref, text) {
    const result = await call<{ ts?: string }>("chat.postMessage", {
      channel: ref.conversation,
      thread_ts: ref.thread,
      text: text.slice(0, MAX_TEXT),
      // 스레드 밖에서도 보이게 하지 않는다. 대화가 채널을 어지럽히면 안 된다.
      reply_broadcast: false,
      unfurl_links: false,
    });
    return result?.ts ?? null;
  },

  async edit(ref, messageId, text) {
    await call("chat.update", {
      channel: ref.conversation,
      ts: messageId,
      text: text.slice(0, MAX_TEXT),
    });
  },

  mention(externalId) {
    return `<@${externalId}>`;
  },

  linkHint() {
    return [
      `이 슬랙 계정이 아직 Antelope 에 연결되어 있지 않습니다.`,
      `${appUrl("/app/settings")} 에서 「슬랙 연결」을 한 번 누르면 됩니다.`,
    ].join("\n");
  },
};

/**
 * 사람의 이름과 이메일.
 *
 * `email` 은 **`users:read.email` 스코프가 있을 때만** 실린다. 없으면 슬랙이
 * 그 필드만 빼고 200 을 준다 — 오류가 아니라 조용한 누락이라, 자동 연결이
 * 안 되는 이유를 여기서 구분할 수 있어야 한다.
 */
export async function slackProfile(
  userId: string,
): Promise<{ displayName: string | null; email: string | null }> {
  const result = await call<{
    user?: { profile?: { display_name?: string; real_name?: string; email?: string } };
  }>("users.info", { user: userId });
  const profile = result?.user?.profile;
  return {
    displayName: profile?.display_name || profile?.real_name || null,
    email: profile?.email ?? null,
  };
}

/** 사람 이름. 실패하면 null 이고, 그때는 id 를 그대로 쓴다 */
export async function slackDisplayName(userId: string): Promise<string | null> {
  return (await slackProfile(userId)).displayName;
}
