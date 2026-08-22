import { headers } from "next/headers";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

import { withTask } from "@/lib/ai/meter";
import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { chatModel } from "@/lib/llm";

import { assistantSystem, type ScreenContext } from "./_lib/prompt";
import { assistantTools } from "./_lib/tools";

export const maxDuration = 60;

/**
 * 앱 어시스턴트 — 어느 화면에서든 오른쪽 열로 부르는 상담 채팅.
 *
 * ⚠ 프록시 matcher(`/app/:path*`) **밖이다.** `/api/chat` 과 같은 이유로 로그인을
 * 요구하고 길이를 자른다 — 배포 URL 만 알면 팀 키를 태울 수 있는 자리다.
 * `system` 은 **받지 않는다.** 어시스턴트의 정체성은 서버가 정한다.
 */
const MAX_MESSAGES = 30;
/** 도구 루프 상한. 4개짜리 도구셋이라 두세 번이면 답이 선다 */
const MAX_STEPS = 5;

/**
 * 화면 내용은 **클라이언트가 보낸 값**이다. 거기서 이미 자르지만 그 상한은
 * 예의지 방어가 아니다 — 라우트에 직접 POST 하면 얼마든지 크게 보낼 수 있고,
 * 그대로 프롬프트에 실으면 우리 키로 컨텍스트를 가득 채우는 것이 공짜가 된다.
 */
const MAX_SCREEN_TEXT = 4_000;
const MAX_SCREEN_FIELDS = 50;

function safeScreen(input: unknown): ScreenContext | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<ScreenContext>;
  const text = typeof raw.text === "string" ? raw.text.slice(0, MAX_SCREEN_TEXT) : "";
  const fields = Array.isArray(raw.fields)
    ? raw.fields
        .filter((field) => field && typeof field.label === "string")
        .slice(0, MAX_SCREEN_FIELDS)
        .map((field) => ({
          label: field.label.slice(0, 80),
          value: typeof field.value === "string" ? field.value.slice(0, 150) : "",
          required: Boolean(field.required),
        }))
    : [];
  if (!text && fields.length === 0) return null;
  return { text, truncated: Boolean(raw.truncated), fields };
}

export async function POST(req: Request) {
  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;
  if (hasDb() && !session) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const {
    messages,
    path,
    screen,
  }: { messages: UIMessage[]; path?: string; screen?: ScreenContext | null } =
    await req.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages 가 필요합니다." }, { status: 400 });
  }

  // 화면 경로는 사용자가 손대는 값이다. 프롬프트에 그대로 박히므로 모양을 본다.
  const screenPath =
    typeof path === "string" && path.startsWith("/") && path.length <= 120 ? path : null;

  const userId = session?.user.id ?? null;

  return withTask({ task: "assistant.chat", runId: null }, async () => {
    const result = streamText({
      model: chatModel(),
      system: assistantSystem({
        path: screenPath,
        screen: safeScreen(screen),
        userName: session?.user.name ?? null,
        hasData: Boolean(userId),
      }),
      messages: await convertToModelMessages(messages.slice(-MAX_MESSAGES)),
      // DB 가 없는 환경(로컬 데모)에서는 읽을 데이터도 없다. 도구를 붙이지 않고,
      // 프롬프트도 「못 본다」로 바뀐다 — 있다고 말해 놓고 못 부르는 것이 최악이다.
      tools: userId ? assistantTools(userId) : undefined,
      stopWhen: stepCountIs(MAX_STEPS),
    });
    return result.toUIMessageStreamResponse();
  });
}
