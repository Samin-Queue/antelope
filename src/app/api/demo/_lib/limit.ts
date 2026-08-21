/**
 * 데모 API 공용 레이트 리밋.
 *
 * 이 아래 엔드포인트는 전부 인증이 없다. 데모 URL 이 공개라 이게 없으면
 * 메일 발송이 스팸 릴레이가 된다.
 */

const hits = new Map<string, number[]>();

/** 슬라이딩 윈도우. 허용되면 true 를 돌려주고 호출을 기록한다. */
export function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  prune(now);
  return true;
}

/** Railway 는 프록시 뒤라 x-forwarded-for 를 본다. */
export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function prune(now: number) {
  for (const [key, times] of hits) {
    const recent = times.filter((t) => now - t < 60 * 60 * 1000);
    if (recent.length === 0) hits.delete(key);
    else hits.set(key, recent);
  }
}
