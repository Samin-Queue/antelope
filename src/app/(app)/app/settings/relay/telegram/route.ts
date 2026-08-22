import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { appUrl } from "@/app/(labs)/lab/relay/_lib/site";
import { linkUrl, telegram } from "@/app/(labs)/lab/relay/_lib/telegram";

export const dynamic = "force-dynamic";

/**
 * 「텔레그램 연결」 — 서명한 딥링크로 보낸다.
 *
 * 슬랙은 OIDC 동의 화면이 그 자리를 맡지만 텔레그램에는 없다. 대신 사용자
 * 식별자를 서명해 `t.me/<봇>?start=<토큰>` 으로 보내고, 봇이 `/start` 로 그
 * 토큰을 받아 검증한다. 사용자는 링크와 [시작] 두 번을 누르면 끝이다.
 *
 * 슬랙 라우트와 **같은 이유로 `/app/*` 아래**에 둔다 — `src/proxy.ts` 가 DB
 * 세션까지 검증해 막아 주는 유일한 구역이다. `/lab/*` 에 두면 로그인 없이
 * 토큰을 발급받을 수 있고, 그 토큰은 **아무 계정에나 텔레그램 id 를 붙이는
 * 열쇠**가 된다.
 */
export async function GET() {
  if (!hasDb()) return Response.json({ error: "DB 가 없습니다." }, { status: 503 });
  if (!telegram.ready()) {
    return Response.json(
      { error: "TELEGRAM_BOT_TOKEN·TELEGRAM_WEBHOOK_SECRET 이 설정되지 않았습니다." },
      { status: 503 },
    );
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const url = await linkUrl(session.user.id);
  if (!url) {
    // `getMe` 가 실패했거나 start 페이로드가 64자를 넘었다. 둘 다 서버 로그에
    // 이유가 남는다. 화면에는 왜 안 됐는지만 알린다.
    return Response.redirect(appUrl("/app/settings?relay=failed&why=telegram-link"), 302);
  }
  return Response.redirect(url, 302);
}
