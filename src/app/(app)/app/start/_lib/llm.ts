import { chatModel, llmInfo } from "@/lib/llm";

/**
 * 단계별 모델 선택.
 *
 * 분류·판정처럼 가벼운 일은 작은 모델로 돌린다. 다만 `solar-mini` 는 Upstage 에만
 * 있다 — Azure 는 LLM_MODEL 이 배포 이름이라 다른 이름을 주면 404 다. 그래서
 * 프로바이더가 Upstage 일 때만 작은 모델을 고르고, 아니면 기본 모델을 그대로 쓴다.
 */
export function smallModel() {
  const info = llmInfo();
  return "provider" in info && info.provider === "upstage"
    ? chatModel("solar-mini")
    : chatModel();
}

export function bigModel() {
  return chatModel();
}

/** 모델 컨텍스트를 넘기지 않도록 자른다. 공고문은 앞부분에 핵심이 몰려 있다 */
export function clip(text: string, max = 30_000): string {
  return text.length > max ? `${text.slice(0, max)}\n…(이하 생략)` : text;
}
