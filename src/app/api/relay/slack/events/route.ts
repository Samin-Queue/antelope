import { after } from "next/server";

import { handle } from "@/app/(labs)/lab/relay/_lib/host";
import { slack } from "@/app/(labs)/lab/relay/_lib/slack";
import { seenEvent } from "@/app/(labs)/lab/relay/_lib/store";

export const dynamic = "force-dynamic";
/**
 * `after` 는 라우트의 max duration 아래에서 돈다. Railway 는 상주 노드 프로세스라
 * 이 값이 강제되지 않지만(개편 문서 §0.5 실측), 얼마나 오래 도는 일인지는
 * 코드에 적혀 있어야 한다.
 */
export const maxDuration = 900;

/**
 * 슬랙 이벤트 수신구.
 *
 * ⚠ **`src/proxy.ts` 의 matcher 밖이다** (`/app`·`/sign-in` 만 잡는다).
 * 인증·인가·멱등을 이 파일이 직접 해야 하고, 하나라도 빠지면 인터넷의 누구나
 * 우리 LLM 키와 Chromium 을 돌릴 수 있다.
 *
 * 순서가 곧 방어선이다:
 *   1. 원문을 먼저 읽는다 — `req.json()` 을 부르면 서명 계산에 쓸 바이트가 사라진다
 *   2. 서명 검증
 *   3. 멱등 (슬랙은 3초 넘으면 같은 이벤트를 다시 보낸다)
 *   4. 즉시 200, 실제 처리는 `after` 에서
 */
export async function POST(req: Request) {
  if (!slack.ready()) {
    return Response.json(
      { error: "SLACK_SIGNING_SECRET·SLACK_BOT_TOKEN 이 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const raw = await req.text();
  if (!slack.verify(req, raw)) {
    return new Response("bad signature", { status: 401 });
  }

  const parsed = slack.parse(raw);

  // Request URL 등록 확인. 평문 그대로 돌려줘야 한다.
  if (parsed.kind === "challenge") {
    return new Response(parsed.challenge, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  // 모르는 이벤트도 **200 이다.** 오류를 주면 슬랙이 재시도를 쌓는다.
  if (parsed.kind === "ignore") return Response.json({ ok: true });

  if (await seenEvent(parsed.incoming.eventId)) {
    return Response.json({ ok: true, duplicate: true });
  }

  after(async () => {
    try {
      await handle(slack, parsed.incoming);
    } catch (error) {
      // 여기서 던지면 아무도 못 본다. 스레드에도 한마디 남긴다.
      console.error("[relay/slack] 처리 실패", error);
      await slack.post(
        parsed.incoming.ref,
        `처리 중 오류가 났습니다 — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  return Response.json({ ok: true });
}
