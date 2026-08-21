import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { env } from "@/lib/env";

/**
 * 파트너 트랙 스위칭 레이어.
 *
 * Upstage(Solar), Azure AI Foundry, Backend.AI, OpenAI 모두 OpenAI 호환
 * /chat/completions 를 노출하므로 base URL + key + model id 세 값만 갈아끼우면
 * 애플리케이션 코드는 그대로 둔 채 트랙을 바꿀 수 있다.
 *
 * 개별 값은 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 로 언제든 덮어쓸 수 있다.
 */
type ProviderId = typeof env.LLM_PROVIDER;

type Preset = {
  name: string;
  baseURL?: string;
  apiKey?: string;
  model: string;
};

function presets(): Record<ProviderId, Preset> {
  return {
    upstage: {
      name: "upstage",
      baseURL: "https://api.upstage.ai/v1",
      apiKey: env.UPSTAGE_API_KEY,
      model: "solar-pro4",
    },
    azure: {
      name: "azure",
      baseURL: env.AZURE_BASE_URL,
      apiKey: env.AZURE_API_KEY,
      model: "gpt-4.1",
    },
    backendai: {
      name: "backendai",
      baseURL: env.BACKENDAI_BASE_URL,
      apiKey: env.BACKENDAI_API_KEY,
      model: "backendai-slm",
    },
    openai: {
      name: "openai",
      baseURL: "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY,
      model: "gpt-4.1-mini",
    },
    custom: {
      name: "custom",
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

function resolve(): ResolvedLlm & { apiKey: string } {
  const provider = env.LLM_PROVIDER;
  const preset = presets()[provider];

  const baseURL = env.LLM_BASE_URL ?? preset.baseURL;
  const apiKey = env.LLM_API_KEY ?? preset.apiKey;
  const model = env.LLM_MODEL ?? preset.model;

  if (!baseURL) throw new Error(`[llm] ${provider}: base URL 미설정 (LLM_BASE_URL)`);
  if (!apiKey) throw new Error(`[llm] ${provider}: API key 미설정 (LLM_API_KEY)`);
  if (!model) throw new Error(`[llm] ${provider}: model id 미설정 (LLM_MODEL)`);

  return { provider, baseURL, apiKey, model };
}

/** 현재 설정 요약 — 키는 노출하지 않는다. 헬스체크/디버깅용. */
export function llmInfo(): ResolvedLlm | { error: string } {
  try {
    const { apiKey: _apiKey, ...rest } = resolve();
    void _apiKey;
    return rest;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function chatModel(overrideModel?: string): LanguageModel {
  const { provider, baseURL, apiKey, model } = resolve();
  const client = createOpenAICompatible({ name: provider, baseURL, apiKey });
  return client.chatModel(overrideModel ?? model);
}
