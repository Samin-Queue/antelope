import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { getDb, schema } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * DATABASE_URL 없이도 모듈이 로드되어야 한다 — next build 가 라우트 모듈을
 * 평가하기 때문이다. 첫 접근 시점에만 실제 커넥션을 만든다.
 */
const lazyDb = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, property) {
    const db = getDb() as unknown as Record<string | symbol, unknown>;
    const value = db[property];
    return typeof value === "function" ? value.bind(db) : value;
  },
});

type OAuthCredentials = { clientId: string; clientSecret: string };

function collectProviders(): Record<string, OAuthCredentials> {
  const providers: Record<string, OAuthCredentials> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
  }
  return providers;
}

/** 자격증명이 들어온 프로바이더만 노출한다. UI 는 이 목록으로 버튼을 그린다. */
export const enabledProviders = Object.keys(collectProviders()) as Array<
  "google" | "github"
>;

export const auth = betterAuth({
  appName: "Antelope",
  // 개발 편의용 폴백 — 프로덕션에서는 BETTER_AUTH_SECRET 을 반드시 설정한다.
  secret: env.BETTER_AUTH_SECRET ?? "dev-only-insecure-secret-change-me",
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(lazyDb, { provider: "pg", schema }),
  socialProviders: collectProviders(),
  session: {
    // 대회 기간(3일) 동안 재로그인을 요구하지 않는다.
    expiresIn: 60 * 60 * 24 * 7,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  // 서버 액션·라우트 핸들러에서 세션 쿠키가 제대로 설정되게 한다. 항상 마지막 플러그인.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
