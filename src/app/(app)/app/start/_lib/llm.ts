import { chatModel, tierModel } from "@/lib/llm";

/**
 * 단계별 모델 선택.
 *
 * 분류·판정·서술처럼 가벼운 일은 작은 모델로 돌린다. 선택은 `src/lib/llm.ts`
 * 의 티어 표가 한다 — 예전엔 여기서 `provider === "upstage"` 한 줄로 갈랐고,
 * 그래서 트랙을 Azure 로 바꾸는 순간 가벼운 호출까지 최상위 모델로 올라갔다.
 */
export function smallModel() {
  return tierModel("small");
}

export function bigModel() {
  return chatModel();
}

/** 모델 컨텍스트를 넘기지 않도록 자른다. 공고문은 앞부분에 핵심이 몰려 있다 */
export function clip(text: string, max = 30_000): string {
  return text.length > max ? `${text.slice(0, max)}\n…(이하 생략)` : text;
}
