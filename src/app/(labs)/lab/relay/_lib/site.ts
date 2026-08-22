import { env } from "@/lib/env";

/**
 * 우리 자신의 주소.
 *
 * 채널 어댑터도 링크를 만들어야 해서(연결 안내·딥링크) `host.ts` 밖으로 뺐다.
 * 요청에서 추측하지 않는다 — 프록시 뒤에서는 `req.url` 이 내부 주소일 수 있고,
 * 웹훅 처리는 애초에 요청 컨텍스트 밖(`after`)에서 돈다.
 */
export function appUrl(path = "/app"): string {
  const base = (env.BETTER_AUTH_URL || "https://antelope.up.railway.app").replace(
    /\/+$/,
    "",
  );
  return `${base}${path}`;
}
