import { z } from "zod";

/**
 * 런타임 환경변수. 빌드 타임에 터지지 않도록 전부 optional 로 두고,
 * 실제로 필요한 시점(getDb, resolveLlm)에서 존재를 강제한다.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),

  // 어떤 파트너 API 로 붙을지. 20:00 트랙 발표 후 이 값 하나만 바꾼다.
  LLM_PROVIDER: z
    .enum(["upstage", "azure", "backendai", "openai", "custom"])
    .default("upstage"),
  LLM_MODEL: z.string().optional(),
  LLM_BASE_URL: z.string().optional(),
  LLM_API_KEY: z.string().optional(),

  UPSTAGE_API_KEY: z.string().optional(),
  /**
   * Studio(/v2) 전용 키. Agent·Config 는 키를 소유한 계정에 묶이므로 v1 과
   * 계정이 갈리면 조회는 200 인데 job 만 403 으로 죽는다. 없으면
   * `UPSTAGE_API_KEY` 로 떨어진다 — 두 키가 같은 계정이면 굳이 나눌 필요가 없다.
   */
  UPSTAGE_STUDIO_API_KEY: z.string().optional(),
  /** Studio 에서 만든 문서 처리 에이전트. 없으면 v1 직접 호출로 떨어진다 */
  UPSTAGE_AGENT_ID: z.string().optional(),
  /** 팀원 실험용 에이전트. 없으면 해당 lab 라우트가 503 을 돌려준다 */
  UPSTAGE_SAMSON_AGENT_ID: z.string().optional(),
  UPSTAGE_MICHAEL_AGENT_ID: z.string().optional(),
  AZURE_API_KEY: z.string().optional(),
  AZURE_BASE_URL: z.string().optional(),
  BACKENDAI_API_KEY: z.string().optional(),
  BACKENDAI_BASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().optional(),

  // 데모 공고 사이트의 이메일 인증 발송(SMTP). 없으면 개발 환경에서만
  // 코드를 응답에 실어 흐름을 이어간다 — src/app/api/demo/email-code 참고.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional(),
  /** 비우면 누구에게나 발송(레이트 리밋만 적용). 콤마로 주소나 @도메인 나열 */
  DEMO_MAIL_ALLOWLIST: z.string().optional(),

  // 공공데이터포털 오픈 API. 키는 URL 인코딩된 채로 발급되므로 그대로 쓴다 —
  // URLSearchParams 에 넣으면 `%2F` 가 다시 인코딩돼 인증이 깨진다.
  JOB_CRAWLING_URL: z.string().optional(),
  JOB_CRAWLING_API_KEY: z.string().optional(),
  EXAM_CRAWLING_URL: z.string().optional(),
  EXAM_CRAWLING_API_KEY: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;

export function required<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${String(key)}`);
  }
  return value as NonNullable<Env[K]>;
}
