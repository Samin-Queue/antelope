/**
 * 입력 길이 다루기.
 *
 * 모델 선택은 여기 없다 — `src/lib/ai/gateway.ts` 가 `task`·`tier` 로 정한다.
 * 예전에는 `smallModel()`·`bigModel()` 두 함수가 있었는데, 후자는
 * `chatModel()` 과 글자 그대로 같았고 전자는 프로바이더 이름 비교 한 줄이라
 * Upstage 가 아니면 둘이 같은 것으로 붕괴했다.
 */

/** 모델 컨텍스트를 넘기지 않도록 자른다. 공고문은 앞부분에 핵심이 몰려 있다 */
export function clip(text: string, max = 30_000): string {
  return text.length > max ? `${text.slice(0, max)}\n…(이하 생략)` : text;
}
