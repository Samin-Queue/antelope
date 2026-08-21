import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
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

export function chatModel(overrideModel?: string): LanguageModel {
  const { provider, baseURL, apiKey, model, headers } = resolve();
  const client = createOpenAICompatible({ name: provider, baseURL, apiKey, headers });
  return client.chatModel(overrideModel ?? model);
}
