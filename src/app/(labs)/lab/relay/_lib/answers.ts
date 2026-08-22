import { z } from "zod";

import { runObject } from "@/lib/ai/gateway";
import type { Need } from "@/app/(app)/app/start/_lib/types";

/**
 * 한 통의 글을 항목들에 나눠 담는다.
 *
 * **폼이 아니라 글로 받는 이유**는 두 채널의 공통 분모가 글 한 통이기 때문이다.
 * 슬랙 modal 은 `trigger_id` 가 필요하고 그 값은 사용자 상호작용 직후 몇 초만
 * 유효한데, 에이전트는 90초 뒤에 묻는다. 텔레그램에는 modal 자체가 없다.
 *
 * ⚠ **확신이 없으면 비워 둔다.** 「1999-04-12」가 생년월일인지 설립일인지
 * 모르겠으면 채우지 않고 다시 묻는다 — 사용자 명의로 실제 접수되는 값이다.
 */

const schema = z.object({
  answers: z
    .array(
      z.object({
        label: z.string().nullish(),
        value: z.string().nullish(),
      }),
    )
    .nullish(),
  /** 어느 항목에도 붙이지 못한 말. 사람에게 그대로 되돌려 준다 */
  leftover: z.array(z.string()).nullish(),
});

export type Absorbed = {
  /** label → 값 */
  filled: Record<string, string>;
  leftover: string[];
};

export async function parseAnswers(
  needs: Need[],
  text: string,
  runId?: string,
): Promise<Absorbed> {
  const empty = needs.filter((need) => need.kind !== "file" && !need.value?.trim());
  if (empty.length === 0 || !text.trim()) return { filled: {}, leftover: [] };

  const allowed = new Map(empty.map((need) => [need.label, need]));

  try {
    const { value } = await runObject(
      { task: "relay.answers", runId },
      {
        role: "너는 사람이 자유롭게 쓴 답을 신청서 항목에 나눠 담는 정리자다.",
        schema,
        rules: [
          "- label 은 **주어진 항목 목록에 있는 글자 그대로**만 쓴다. 새로 만들지 않는다.",
          "- 한 문장에 여러 항목의 답이 섞여 있으면 나눈다.",
          "- **확신이 없으면 넣지 않는다.** 애매한 값은 leftover 에 원문 그대로 남긴다.",
          "- 값은 사람이 쓴 그대로 옮긴다. 단위·통화·표기를 임의로 바꾸지 않는다.",
          "- 날짜만 예외다. YYYY-MM-DD 로 바꾼다.",
          "- 선택지가 있는 항목은 그 선택지 중 하나와 맞을 때만 채운다.",
          "- 답이 아니라 되묻는 말(「이건 뭐야?」)은 채우지 말고 leftover 로 보낸다.",
          "- **어느 항목인지 글에서 알 수 없는 값**(항목 이름도 문맥도 없이 덩그러니 있는 숫자·날짜)은 채우지 말고 leftover 로 보낸다.",
        ],
        prompt: [
          "채워야 하는 항목:",
          ...empty.map(
            (need) =>
              `  - ${need.label} [${need.kind}${need.required ? ", 필수" : ""}]` +
              (need.options?.length ? ` 선택지: ${need.options.join(" / ")}` : "") +
              (need.why ? ` — ${need.why}` : ""),
          ),
          "",
          "사람이 쓴 답:",
          text.slice(0, 4_000),
        ].join("\n"),
        repair: 0,
      },
    );

    const filled: Record<string, string> = {};
    for (const item of value.answers ?? []) {
      const label = item?.label?.trim();
      const answer = item?.value?.trim();
      // 모델이 지어낸 항목명은 버린다. 없는 칸에 값을 넣을 수는 없다.
      if (!label || !answer || !allowed.has(label)) continue;
      filled[label] = answer;
    }
    const leftover = (value.leftover ?? []).map((x) => String(x).trim()).filter(Boolean);

    /**
     * **항목을 특정할 근거가 글에 있어야 채운다.**
     *
     * 프롬프트로는 막히지 않았다 — 실측: 「음 그건 좀 나중에 알려줄게요. 아
     * 그리고 1999-04-12」에서 그 날짜를 법인 설립일로 단정했다. 규칙을 여러 줄
     * 더 붙이는 대신 코드가 판정한다: 라벨의 낱말 중 하나라도 사람이 쓴 글에
     * 있어야 한다. 「법인은 2024년 3월 15일에 세웠어요」는 「법인」이 있어 통과하고,
     * 값만 덩그러니 있는 날짜는 걸린다.
     *
     * 대가는 「우리 회사는 삼인큐예요」처럼 항목 이름을 안 쓴 답이 버려지는 것이다.
     * 그때는 다시 묻는다 — 사용자 명의로 접수되는 값이라 조용히 틀리는 쪽이 더 비싸다.
     */
    if (empty.length > 1) {
      for (const [label, answer] of Object.entries(filled)) {
        if (!grounded(label, answer, text)) delete filled[label];
      }
    }

    return { filled, leftover };
  } catch (error) {
    // 배분에 실패해도 스레드는 살아야 한다. 사람에게 다시 묻는다.
    console.error("[relay/answers] 배분 실패", error);
    return { filled: {}, leftover: [] };
  }
}

/** 채운 값을 마스터 테이블에 반영한다. 출처를 `user` 로 남겨 다음에 다시 묻지 않는다 */
export function applyAnswers(needs: Need[], filled: Record<string, string>): Need[] {
  return needs.map((need) => {
    const value = filled[need.label];
    if (!value || need.value?.trim()) return need;
    return { ...need, value, from: "user" as const };
  });
}

export function missingOf(needs: Need[]): Need[] {
  return needs.filter(
    (need) => need.required && need.kind !== "file" && !need.value?.trim(),
  );
}

/**
 * 라벨을 가리키는 낱말이 글에 있는가.
 *
 * 남은 항목이 **하나뿐이면** 이 검사를 건너뛴다 — 그때는 값만 와도 어느 칸인지
 * 분명하고, 그 상황에서까지 항목 이름을 다시 쓰게 하면 대화가 아니라 서식이 된다.
 */
function grounded(label: string, answer: string, text: string): boolean {
  const haystack = text.replace(/\s+/g, "");
  const words = label
    .split(/[\s()·,/]+/)
    .map((w) => w.replace(/[은는이가을를의]$/, ""))
    .filter((w) => w.length >= 2);
  if (words.some((w) => haystack.includes(w))) return true;
  // 라벨이 한 글자거나 조사에 다 깎였으면 판정할 근거가 없다 — 통과시킨다.
  return words.length === 0;
}
