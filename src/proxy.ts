import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";

/** 열린 리디렉트가 되지 않게 같은 출처의 경로만 통과시킨다 — `//evil.com` 은 외부다. */
function safePath(value: string | null, fallback = "/app"): string {
  if (!value) return fallback;
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/**
 * 로그인 상태와 화면을 맞추는 단 하나의 문.
 *
 * · `/app` 은 세션이 없으면 렌더가 시작되기 전에 `/sign-in` 으로 던진다.
 * · `/sign-in` 은 이미 로그인했으면 워크스페이스로 보낸다. 안 그러면 헤더의
 *   「로그인」을 눌러도 제자리로 돌아와 **아무 일도 안 일어난 것처럼 보인다.**
 *
 * **레이아웃·페이지에서 `redirect()` 하는 것으로는 부족하다.** 그때는 이미 셸이
 * 흘러 나간 뒤라 Next 가 HTTP 상태를 못 바꾸고, 리디렉트를 RSC 페이로드에
 * `NEXT_REDIRECT` 로 실어 보낸다 — 응답은 200 이고 브라우저는 하이드레이션 뒤에야
 * 움직인다. 그 사이 엉뚱한 화면이 한 번 번쩍인다(실측). 여기서 막으면 문서 요청
 * 자체가 307 이라 그 깜빡임이 없다.
 *
 * 쿠키의 존재만 보지 않고 **DB 까지 확인한다.** 만료·로그아웃 후 남은 쿠키·위조
 * 쿠키가 전부 여기서 걸린다. Next 16 의 프록시는 Node.js 런타임이라 가능하다
 * (엣지 런타임이었다면 쿠키 존재만 보는 낙관적 검사가 한계다).
 *
 * ⚠ Next 16 에서 `middleware.ts` 는 `proxy.ts` 로 이름이 바뀌었다. 파일은 `app` 과
 * 같은 층, 즉 `src/` 바로 아래에 있어야 잡힌다.
 */
export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  // DB 가 잠깐 안 붙어도 로그인 화면까지 막히면 안 된다. 조회가 실패하면
  // 「세션 없음」으로 본다 — `/app` 은 닫히고 `/sign-in` 은 열린다.
  const session = hasDb()
    ? await auth.api.getSession({ headers: request.headers }).catch(() => null)
    : null;

  if (url.pathname === "/sign-in") {
    if (!session) return NextResponse.next();
    return NextResponse.redirect(new URL(safePath(url.searchParams.get("next")), url));
  }

  if (session) return NextResponse.next();

  const signIn = new URL("/sign-in", url);
  // 로그인 뒤 원래 가려던 곳으로 돌려보낸다.
  signIn.searchParams.set("next", safePath(`${url.pathname}${url.search}`));
  return NextResponse.redirect(signIn);
}

export const config = { matcher: ["/app", "/app/:path*", "/sign-in"] };
