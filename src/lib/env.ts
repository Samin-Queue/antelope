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
  AZURE_API_KEY: z.string().optional(),
  AZURE_BASE_URL: z.string().optional(),
  BACKENDAI_API_KEY: z.string().optional(),
  BACKENDAI_BASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().optional(),
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
