import type { ModelMessage } from "ai";

import { env } from "@/lib/env";

/**
 * 도구 루프의 컨텍스트 창.
 *
 * 브라우저 에이전트는 스텝마다 화면 스냅샷을 도구 결과로 돌려받고, 그것이
 * 메시지 배열에 **append-only 로 쌓인다.** 스냅샷 한 장이 요소 40개 기준
 * 5~6KB 이고 `maxSteps` 는 60이므로 누적 입력이 스텝 수의 제곱으로 는다 —
 * 마지막 요청이 100KB 를 넘고, 그 대부분이 이미 지나간 화면이다.
 *
 * **오래된 스냅샷은 쓸모가 없는 정도가 아니라 해롭다.** 거기 적힌 `e12` 같은
 * ref 는 지금 화면에 없고, 모델이 그걸 믿고 부르면 「직전 read 에 없다」로
 * 튕긴다. 지운 자리에 그 사실을 적어 두는 편이 낫다.
 *
 * 최근 것 몇 장만 원문으로 두고 나머지는 스텁으로 바꾼다. **앞쪽 접두는
 * 바이트가 그대로 유지된다** — 스텝마다 창 밖으로 갓 밀려난 한 건만 새로
 * 치환되므로 프롬프트 접두 캐싱과 공존한다.
 */
type Options = {
  /** 원문으로 남길 최근 스냅샷 수 */
  keep: number;
  /** 이 도구 결과가 화면 스냅샷인가 */
  isBulky: (text: string) => boolean;
  /** 지운 자리에 남길 말. ref 가 무효라는 사실을 반드시 적는다 */
  stub: string;
};

/** 도구 결과의 본문. 텍스트가 아니면 대상이 아니다 */
function textOf(part: unknown): string | null {
  const p = part as { type?: string; output?: { type?: string; value?: unknown } };
  if (p?.type !== "tool-result") return null;
  if (p.output?.type !== "text") return null;
  return typeof p.output.value === "string" ? p.output.value : null;
}

export function pruneToolResults(
  messages: ModelMessage[],
  { keep, isBulky, stub }: Options,
): ModelMessage[] {
  if (env.AI_PREPARE_STEP === "off") return messages;

  // 뒤에서부터 세어야 「최근 N개」가 정해진다.
  let seen = 0;
  const replace = new Set<string>();
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "tool" || !Array.isArray(message.content)) continue;
    for (let j = message.content.length - 1; j >= 0; j -= 1) {
      const text = textOf(message.content[j]);
      if (text === null || !isBulky(text)) continue;
      seen += 1;
      if (seen > keep) replace.add(`${i}:${j}`);
    }
  }
  if (replace.size === 0) return messages;

  // 원본을 건드리지 않는다. SDK 가 같은 배열을 다시 쓴다.
  return messages.map((message, i) => {
    if (message.role !== "tool" || !Array.isArray(message.content)) return message;
    if (!message.content.some((_, j) => replace.has(`${i}:${j}`))) return message;
    return {
      ...message,
      content: message.content.map((part, j) =>
        replace.has(`${i}:${j}`)
          ? { ...(part as object), output: { type: "text" as const, value: stub } }
          : part,
      ),
    } as ModelMessage;
  });
}
