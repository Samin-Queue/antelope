import { after } from "next/server";

import { handle } from "@/app/(labs)/lab/relay/_lib/host";
import { linkIdentity, seenEvent } from "@/app/(labs)/lab/relay/_lib/store";
import { telegram, verifyLinkToken } from "@/app/(labs)/lab/relay/_lib/telegram";

export const dynamic = "force-dynamic";
/** 슬랙 쪽과 같은 이유로 적어 둔다 — `after` 가 이 아래에서 돈다 */
export const maxDuration = 900;

/** `/start <토큰>` — 딥링크로 넘어온 계정 연결 */
const START = /^\/start(?:@\w+)?\s+(\S+)$/;

/**
 * 텔레그램 이벤트 수신구.
 *
 * ⚠ **`src/proxy.ts` 의 matcher 밖이다** (`/app`·`/sign-in` 만 잡는다).
 * 슬랙 라우트와 같은 방어선을 이 파일이 직접 세운다:
 *
 *   1. 원문을 먼저 읽는다 — 계약이 `rawBody` 를 요구한다
 *   2. `secret_token` 대조 (슬랙의 서명 검증 자리)
 *   3. 멱등 — 200 을 못 받으면 같은 update_id 로 다시 온다
 *   4. 즉시 200, 실제 처리는 `after` 에서
 *
 * 텔레그램에는 `url_verification` 같은 등록 확인 절차가 없다. `setWebhook`
 * 한 번이 전부라 `challenge` 분기가 필요 없다.
 */
export async function POST(req: Request) {
  if (!telegram.ready()) {
    return Response.json(
      { error: "TELEGRAM_BOT_TOKEN·TELEGRAM_WEBHOOK_SECRET 이 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const raw = await req.text();
  if (!telegram.verify(req, raw)) {
    return new Response("bad secret token", { status: 401 });
  }

  const parsed = telegram.parse(raw);
  // 모르는 업데이트도 **200 이다.** 오류를 주면 텔레그램이 재시도를 쌓는다.
  if (parsed.kind !== "message") return Response.json({ ok: true });

  const incoming = parsed.incoming;
  if (await seenEvent(incoming.eventId)) {
    return Response.json({ ok: true, duplicate: true });
  }

  /**
   * 계정 연결이 먼저다.
   *
   * `handle()` 은 연결되지 않은 사람을 돌려보내므로, `/start <토큰>` 이
   * 거기까지 가면 안내문만 다시 받고 영영 연결되지 않는다.
   *
   * **1:1 대화에서만 받는다.** 그룹에 토큰을 적으면 그것을 본 사람이 먼저
   * 써서 남의 계정에 자기 텔레그램 id 를 붙일 수 있다.
   */
  const start = START.exec(incoming.text);
  if (start) {
    const userId = incoming.isDirect ? verifyLinkToken(start[1]) : null;
    after(async () => {
      if (!incoming.isDirect) {
        await telegram.post(
          incoming.ref,
          "계정 연결은 봇과의 1:1 대화에서만 됩니다. 이 봇에게 직접 말을 걸어 주세요.",
        );
        return;
      }
      if (!userId) {
        await telegram.post(
          incoming.ref,
          "연결 링크가 만료되었거나 올바르지 않습니다. 설정 화면에서 다시 눌러 주세요.",
        );
        return;
      }
      try {
        await linkIdentity({
          userId,
          channel: "telegram",
          externalId: incoming.from,
          workspaceId: null,
          displayName: incoming.displayName,
        });
        await telegram.post(
          incoming.ref,
          "연결됐습니다. 이제 공고 링크나 파일을 보내면 바로 준비를 시작합니다.",
        );
      } catch (error) {
        console.error("[relay/telegram] 연결 실패", error);
        await telegram.post(
          incoming.ref,
          "연결에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    });
    return Response.json({ ok: true });
  }

  // 인자 없는 `/start` — 딥링크를 안 거치고 그냥 봇을 연 경우다.
  if (/^\/start(?:@\w+)?$/.test(incoming.text)) {
    after(async () => {
      await telegram.post(incoming.ref, telegram.linkHint());
    });
    return Response.json({ ok: true });
  }

  after(async () => {
    try {
      await handle(telegram, incoming);
    } catch (error) {
      // 여기서 던지면 아무도 못 본다. 대화에도 한마디 남긴다.
      console.error("[relay/telegram] 처리 실패", error);
      await telegram.post(
        incoming.ref,
        `처리 중 오류가 났습니다 — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  return Response.json({ ok: true });
}
