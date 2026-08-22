import { headers } from "next/headers";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { withTask } from "@/lib/ai/meter";
import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { chatModel } from "@/lib/llm";

export const maxDuration = 60;

/**
 * 플레이그라운드 채팅.
 *
 * ⚠ 이 라우트는 프록시 matcher(`/app/:path*`) **밖에 있다.** 인증 없이
 * `system` 을 통째로 지정할 수 있었고 길이 상한도 없었다 — 배포 URL 만 알면
 * 팀 키를 무제한으로 태울 수 있다는 뜻이다. 로그인을 요구하고 입력을 자른다.
 * DB 가 없는 환경(로컬 데모)에서는 예전처럼 연다.
 */
const MAX_SYSTEM = 4_000;
const MAX_MESSAGES = 40;

export async function POST(req: Request) {
  if (hasDb()) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
  }

  const { messages, system }: { messages: UIMessage[]; system?: string } =
    await req.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages 가 필요합니다." }, { status: 400 });
  }

  return withTask({ task: "playground.chat", runId: null }, async () => {
    const result = streamText({
      model: chatModel(),
      system: system?.slice(0, MAX_SYSTEM),
      messages: await convertToModelMessages(messages.slice(-MAX_MESSAGES)),
    });
    return result.toUIMessageStreamResponse();
  });
}
