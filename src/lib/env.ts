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
  /**
   * 문서 요약(유효성 검사) · 신청 양식 분석(정보 분석).
   * 「목표 시작하기」 플로우는 없으면 Solar 직접 호출로 떨어지고,
   * `/lab/validation`·`/lab/analysis` 라우트는 503 을 돌려준다.
   */
  UPSTAGE_VALIDATION_AGENT_ID: z.string().optional(),
  UPSTAGE_ANALYSIS_AGENT_ID: z.string().optional(),
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

  /**
   * 네이버 검색 API. **없어도 웹 검색은 돈다** — `src/lib/search.ts` 가 키 없이
   * `search.naver.com` HTML 을 긁는 레인을 함께 갖고 있다. 키를 넣으면 규격
   * 응답으로 바뀌어 마크업 변경에 안 흔들린다. 둘 중 하나만 있으면 인증이
   * 안 되므로 **함께** 본다.
   */
  NAVER_CLIENT_ID: z.string().optional(),
  NAVER_CLIENT_SECRET: z.string().optional(),

  /**
   * 킬스위치. 데모 당일 회귀를 배포 변수 하나로 5분 안에 되돌린다.
   *
   * ⚠ `env` 는 import 시점에 한 번만 parse 된다 — 런타임 토글은 안 된다.
   * 재배포가 필요하다는 뜻이고, 그래도 코드를 되돌리는 것보다 빠르다.
   *
   * - `AI_PREPARE_STEP`   브라우저 루프의 컨텍스트 창 관리
   * - `AI_TIER_ROUTING`   작업별 모델 티어링
   * - `AI_REPAIR`         구조화 출력 복구 루프
   * - `AI_VERIFY`         의미 검증(날짜·단위·플레이스홀더)
   * - `AI_SUBMIT_GATE`    제출 전 값 대조 게이트
   */
  AI_PREPARE_STEP: z.enum(["on", "off"]).default("on"),
  AI_TIER_ROUTING: z.enum(["on", "off"]).default("on"),
  AI_REPAIR: z.enum(["on", "off"]).default("on"),
  AI_VERIFY: z.enum(["on", "off"]).default("on"),
  AI_SUBMIT_GATE: z.enum(["on", "off"]).default("on"),
  /** 작은 모델의 배포 이름. Azure·custom 트랙에서 티어링을 살린다 */
  LLM_MODEL_SMALL: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  /**
   * 릴레이(슬랙) — `/api/relay/slack/events`.
   *
   * 둘 다 없으면 라우트가 503 을 돌려주고 앱은 그대로 뜬다. 하나만 있으면
   * 서명 검증이나 발신 중 한쪽이 조용히 죽으므로 **둘을 함께 본다**
   * (`lab/relay/_lib/slack.ts` 의 `ready()`).
   */
  SLACK_SIGNING_SECRET: z.string().optional(),
  /** `xoxb-…`. 단일 워크스페이스 지름길 — 여러 워크스페이스는 OAuth 설치가 필요하다 */
  SLACK_BOT_TOKEN: z.string().optional(),
  /**
   * 「슬랙 계정 연결」 동의 화면(OIDC)에 쓴다. Basic Information 의 App Credentials.
   * 없으면 설정 화면에 연결 버튼이 그려지지 않는다 — 구글 연동과 같은 방식이다.
   */
  /**
   * 텔레그램 봇. BotFather 가 준 토큰과, `setWebhook` 에 등록한 비밀값.
   *
   * ⚠ `TELEGRAM_WEBHOOK_SECRET` 은 **고정값이다.** 빌드마다 새로 만들면
   *   등록해 둔 값과 어긋나 모든 웹훅이 401 이 되고, 증상은 「봇이 아무
   *   반응이 없다」로만 나타난다. 한 번 정하고 바꾸지 않는다.
   */
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
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
