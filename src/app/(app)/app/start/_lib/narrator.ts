import { generateObject } from "ai";
import { z } from "zod";

import type { Ctx } from "./intake";
import { bigModel, clip } from "./llm";
import type { CardKey } from "./types";

/**
 * 오케스트레이터 — 지금 무슨 일이 일어나고 있는지 사람 말로 쓴다.
 *
 * 카드마다 기계 로그(`parse → classify → extract-grant`)를 흘리면 개발자만
 * 읽는다. 사용자가 알아야 하는 것은 **무엇을 알아냈고 그래서 다음이 무엇인가**다.
 *
 * 단계마다 따로 쓰지 않고 **하나가 이어서 쓴다.** 그래야 「자료 조사에서 신청
 * URL 을 못 찾아 계획에서 사람에게 묻기로 했다」 처럼 앞뒤가 이어진 말이 나온다.
 * 단계별로 각자 쓰면 매번 처음부터 설명하는 글이 된다.
 *
 * **지어내지 않는다.** 사실은 코드가 산출물에서 뽑아 넘기고, 서술자는 그것만
 * 가지고 쓴다 — 이 제품이 파는 것이 그 신뢰다.
 */
export type Narration = {
  /** 카드 상태 줄. 「정보 수집 완료 · 39개 출처 탐색됨」 */
  headline: string;
  /** 두세 문장. 무엇을 알아냈고 그래서 무엇을 하는지 */
  body: string;
};

export type NarrationTurn = { card: CardKey; headline: string; body: string };

const schema = z.object({
  headline: z.string().nullish(),
  body: z.string().nullish(),
});

/** 카드가 하는 일. 서술자가 그 자리에 맞는 말을 쓰게 한다 */
const ROLE: Record<CardKey, string> = {
  goal: "사용자가 무엇을 신청하려는지 파악하는 자리",
  gather: "공고와 관련된 자료를 웹에서 모으는 자리",
  analyze: "모은 자료를 읽고 신청 양식을 구조화하는 자리",
  plan: "언제 무엇을 할지 순서를 세우는 자리",
  data: "신청에 필요한 값을 채우고 모자란 것을 묻는 자리",
  file: "제출할 서류를 만들고 서식을 채우는 자리",
  browser: "실제 신청 사이트를 조작하는 자리",
};

export async function narrate(
  input: {
    card: CardKey;
    /** 그 단계가 실제로 낸 것. **코드가 뽑는다** — 모델이 추측하지 않게 */
    facts: string;
    /** 지금까지 쓴 것. 이게 맥락이다 */
    history: NarrationTurn[];
    /** 흐름이 꺾인 경우 그 이유 */
    reason?: string;
  },
  ctx?: Ctx,
): Promise<Narration | null> {
  try {
    const { object } = await generateObject({
      model: bigModel(),
      schema,
      system: [
        "너는 여러 에이전트가 신청을 준비하는 과정을 사용자에게 중계하는 서술자다.",
        "결과를 아래 JSON 구조 그대로 낸다.",
        `{ "headline": string, "body": string }`,
        "",
        "- headline: 상태 한 줄. 「정보 수집 완료 · 39개 출처 탐색됨」 처럼 결과와 수치를 담는다. 30자 이내.",
        "- body: 두세 문장. **무엇을 알아냈고 그래서 다음이 무엇인지**를 쓴다.",
        "- **주어진 사실만 쓴다.** 날짜·금액·개수는 사실에 있는 것만 옮기고, 없는 것은 쓰지 않는다.",
        "- 앞에서 이미 말한 것을 되풀이하지 않는다. 이어지는 한 편의 글처럼 쓴다.",
        "- 기계 용어를 쓰지 않는다 — `parse`·`classify`·`stage` 대신 사람 말로.",
        "- 실패했으면 숨기지 않는다. 무엇이 막혔고 그래서 어떻게 할 것인지 쓴다.",
        "- 한국어. 담백하게. 감탄사·수식어를 넣지 않는다.",
      ].join("\n"),
      prompt: [
        `지금 자리: ${ROLE[input.card]}`,
        input.reason ? `이 자리로 돌아온 이유: ${input.reason}` : null,
        "",
        input.history.length > 0 ? "지금까지 한 말:" : null,
        ...input.history
          .slice(-8)
          .map((turn) => `  [${turn.card}] ${turn.headline} — ${turn.body}`),
        "",
        "이번에 실제로 일어난 일:",
        clip(input.facts, 12_000),
      ]
        .filter((line) => line !== null)
        .join("\n"),
    });

    const headline = object.headline?.trim();
    const body = object.body?.trim();
    if (!headline && !body) return null;
    return { headline: headline || "진행 중", body: body || "" };
  } catch (error) {
    // 서술이 실패해도 실행은 계속한다. 화면에는 기계 로그가 남는다.
    ctx?.log(`서술 실패: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}
