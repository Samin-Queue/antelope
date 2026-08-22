import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { meteredFetch } from "@/lib/ai/meter";
import { env } from "@/lib/env";

/**
 * 파트너 트랙 스위칭 레이어.
 *
 * Upstage(Solar), Azure AI Foundry, OpenAI 모두 OpenAI 호환 /chat/completions 를
 * 노출하므로 base URL + key + model id 세 값만 갈아끼우면 애플리케이션 코드는
 * 그대로 둔 채 트랙을 바꿀 수 있다.
 *
 * 개별 값은 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 로 언제든 덮어쓸 수 있다.
 */
type ProviderId = typeof env.LLM_PROVIDER;

type Preset = {
  baseURL?: string;
  apiKey?: string;
  model: string;
  /** OpenAI 규격의 Authorization: Bearer 외에 추가로 필요한 헤더 */
  headers?: (apiKey: string) => Record<string, string>;
};

function presets(): Record<ProviderId, Preset> {
  return {
    upstage: {
      baseURL: "https://api.upstage.ai/v1",
      apiKey: env.UPSTAGE_API_KEY,
      model: "solar-pro4",
    },
    azure: {
      // 신형 v1 경로만 쓴다 — api-version 쿼리가 필요 없고 OpenAI 규격과 같다.
      //   https://<resource>.services.ai.azure.com/openai/v1
      //   https://<resource>.openai.azure.com/openai/v1
      // 레거시 /openai/deployments/<name>/chat/completions?api-version=... 는 지원하지 않는다.
      baseURL: env.AZURE_BASE_URL,
      apiKey: env.AZURE_API_KEY,
      // Azure 는 모델 id 가 아니라 "배포(deployment) 이름"을 받는다.
      model: env.LLM_MODEL ?? "",
      // Azure 는 Bearer 가 아니라 api-key 헤더로 인증한다. 둘 다 보내면 어느 쪽이든 통과.
      headers: (apiKey) => ({ "api-key": apiKey }),
    },
    backendai: {
      baseURL: env.BACKENDAI_BASE_URL,
      apiKey: env.BACKENDAI_API_KEY,
      model: env.LLM_MODEL ?? "",
    },
    openai: {
      baseURL: "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
    },
    custom: {
      baseURL: env.LLM_BASE_URL,
      apiKey: env.LLM_API_KEY,
      model: env.LLM_MODEL ?? "",
    },
  };
}

export type ResolvedLlm = {
  provider: ProviderId;
  baseURL: string;
  model: string;
};

function resolve(): ResolvedLlm & {
  apiKey: string;
  headers?: Record<string, string>;
} {
  const provider = env.LLM_PROVIDER;
  const preset = presets()[provider];

  const baseURL = env.LLM_BASE_URL ?? preset.baseURL;
  const apiKey = env.LLM_API_KEY ?? preset.apiKey;
  const model = env.LLM_MODEL ?? preset.model;

  if (!baseURL) throw new Error(`[llm] ${provider}: base URL 미설정 (LLM_BASE_URL)`);
  if (!apiKey) throw new Error(`[llm] ${provider}: API key 미설정 (LLM_API_KEY)`);
  if (!model) throw new Error(`[llm] ${provider}: model id 미설정 (LLM_MODEL)`);

  return { provider, baseURL, apiKey, model, headers: preset.headers?.(apiKey) };
}

/** 현재 설정 요약 — 키는 노출하지 않는다. 헬스체크/디버깅용. */
export function llmInfo(): ResolvedLlm | { error: string } {
  try {
    const { provider, baseURL, model } = resolve();
    return { provider, baseURL, model };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 프로바이더 인스턴스는 **한 번만 만든다.**
 *
 * 호출마다 새로 만들면 그때마다 fetch 훅과 내부 상태가 새로 생긴다. 키가
 * 같으면 같은 것을 쓴다 — 키는 캐시 키에 해시로만 들어간다.
 */
const clients = new Map<string, ReturnType<typeof createOpenAICompatible>>();

function clientFor(
  provider: ProviderId,
  baseURL: string,
  apiKey: string,
  headers?: Record<string, string>,
) {
  const key = `${provider}|${baseURL}|${apiKey.length}|${apiKey.slice(-6)}|${JSON.stringify(headers ?? {})}`;
  let client = clients.get(key);
  if (!client) {
    client = createOpenAICompatible({
      name: provider,
      baseURL,
      apiKey,
      headers,
      // 토큰이 응답에 실려 오게 한다. 이게 없으면 원장이 지연만 안다.
      includeUsage: true,
      // 계측의 **유일한** 훅 지점. 호출부 21곳을 안 고치고 전부 잡힌다.
      fetch: meteredFetch,
    });
    clients.set(key, client);
  }
  return client;
}

export function chatModel(overrideModel?: string): LanguageModel {
  const { provider, baseURL, apiKey, model, headers } = resolve();
  return clientFor(provider, baseURL, apiKey, headers).chatModel(overrideModel ?? model);
}

/**
 * 티어 — 이 작업에 어느 크기의 모델이 필요한가.
 *
 * 예전에는 `provider === "upstage"` 한 줄로 갈랐다. 그래서 트랙을 Azure 로
 * 바꾸는 순간 분류·판정·서술 같은 가벼운 호출이 전부 최상위 모델로 올라갔고,
 * 반대로 `LLM_MODEL=solar-pro3` 를 명시해도 `chatModel("solar-mini")` 가 그걸
 * 덮었다. 티어를 **표로** 두면 그 두 버그가 같이 사라진다.
 *
 * 작은 티어가 없는 프로바이더에서는 기본 모델로 승격한다 — 없는 배포 이름을
 * 보내면 404 이고, 그건 절감이 아니라 장애다.
 */
export type Tier = "small" | "large";

const SMALL: Partial<Record<ProviderId, string>> = {
  upstage: "solar-mini",
  openai: "gpt-4.1-nano",
};

export function tierModel(tier: Tier): LanguageModel {
  if (tier === "large" || env.AI_TIER_ROUTING === "off") return chatModel();
  // 명시 설정이 표를 이긴다. Azure·custom 은 배포 이름을 우리가 알 수 없다.
  const small = env.LLM_MODEL_SMALL ?? SMALL[env.LLM_PROVIDER];
  return small ? chatModel(small) : chatModel();
}
