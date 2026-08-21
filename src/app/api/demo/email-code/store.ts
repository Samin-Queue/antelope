import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * 데모 이메일 인증코드 보관소.
 *
 * 코드를 **서버가 쥐고 응답에 싣지 않는다**. 이게 이 모듈의 존재 이유다 —
 * 코드가 클라이언트에 있으면 메일을 열지 않아도 인증이 통과해서, 에이전트가
 * 실제로 마주칠 마찰을 재현하지 못한다.
 *
 * 저장은 프로세스 메모리다. 데모라 재시작하면 날아가도 되고, Railway 는 단일
 * 인스턴스라 인스턴스 간 공유 문제도 없다. 영속이 필요해지면 그때 옮긴다.
 */

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Entry = { hash: string; expiresAt: number; attempts: number };

const codes = new Map<string, Entry>();

export function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

function hash(email: string, code: string) {
  return createHash("sha256").update(`${email}:${code}`).digest("hex");
}

export function issue(email: string) {
  prune();
  // 6자리. randomInt 는 CSPRNG 라 클라이언트가 값을 예측할 수 없다
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  codes.set(email, {
    hash: hash(email, code),
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
  });
  return { code, expiresInMinutes: TTL_MS / 60_000 };
}

export type VerifyResult =
  "ok" | "not-found" | "expired" | "too-many-attempts" | "mismatch";

export function verify(email: string, code: string): VerifyResult {
  prune();
  const entry = codes.get(email);
  if (!entry) return "not-found";
  if (Date.now() > entry.expiresAt) {
    codes.delete(email);
    return "expired";
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    codes.delete(email);
    return "too-many-attempts";
  }
  entry.attempts += 1;

  const got = Buffer.from(hash(email, code), "hex");
  const want = Buffer.from(entry.hash, "hex");
  // 길이가 같아야 timingSafeEqual 이 던지지 않는다. 둘 다 sha256 이라 항상 32바이트다
  if (got.length !== want.length || !timingSafeEqual(got, want)) return "mismatch";

  codes.delete(email);
  return "ok";
}

function prune() {
  const now = Date.now();
  for (const [key, entry] of codes) {
    if (now > entry.expiresAt) codes.delete(key);
  }
}
