import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";

/**
 * 세션 조회의 단일 경로.
 *
 * ⚠ `headers()` 를 `hasDb()` 검사 **밖에서** 먼저 부른다. 안에 두면 DATABASE_URL 이
 * 없는 도커 빌드에서 호출 자체가 실행되지 않고, 그러면 그 페이지에 동적 API 가
 * 하나도 없어 Next 가 빌드 타임에 **정적 프리렌더**해 버린다.
 *
 * 실제로 프로덕션 랜딩이 이렇게 깨졌다 — `cache-control: s-maxage=31536000` 에
 * `x-nextjs-prerender: 1` 로, 빌드 시점의 「로그아웃 + 프로바이더 없음」 스냅샷이
 * 1년짜리 캐시로 굳었다. 증상은 셋으로 나뉘어 나타났다:
 *   · 로그인해도 헤더가 계속 「로그인」을 보여준다 (세션이 풀린 것처럼 보인다)
 *   · 그 버튼을 누르면 `/sign-in` 이 다시 `/` 로 되돌려 아무 일도 안 일어난다
 *   · 히어로 로그인 다이얼로그가 `enabledProviders: []` 로 굳어 버튼이 안 그려진다
 *
 * `headers()` 는 프리렌더 중에 호출되면 정적 생성을 중단시킨다
 * (`next/dist/server/request/headers.js` 의 `throwToInterruptStaticGeneration`).
 * 그러니 세션이 필요한 화면은 반드시 이 함수를 거친다.
 */
export async function currentSession() {
  const requestHeaders = await headers();
  if (!hasDb()) return null;
  return auth.api.getSession({ headers: requestHeaders });
}
