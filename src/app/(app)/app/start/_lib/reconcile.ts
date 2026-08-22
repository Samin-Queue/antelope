import { generateObject } from "ai";
import { z } from "zod";

import { bigModel } from "./llm";
import { makeNeed, mergeNeeds, normalizeKey } from "./needs";
import type { Need } from "./types";

/**
 * 두 목록을 하나로.
 *
 * Michael 은 공고에서 "성명·연락처" 를, research 는 신청 폼에서 "이름·휴대전화" 를
 * 뽑는다. 글자가 달라 키 병합으로는 못 합친다 — 같은 것을 두 번 묻는 게 가장
 * 나쁜 경험이라 모델이 한 번 더 본다. 폼 라벨이 실제로 채울 칸이므로 그 이름을
 * 남기고, Michael 의 필수 여부·근거는 끌어온다. 섹션 제목·예시 값은 버린다.
 */
const schema = z.object({
  needs: z
    .array(
      z.object({
        label: z.string(),
        kind: z.string().nullish(),
        required: z.boolean().nullish(),
        why: z.string().nullish(),
        source: z.string().nullish(),
      }),
    )
    .nullish(),
});

export async function reconcileNeeds(michael: Need[], research: Need[]): Promise<Need[]> {
  if (michael.length === 0 || research.length === 0) return mergeNeeds(michael, research);

  try {
    const { object } = await generateObject({
      model: bigModel(),
      schema,
      system: [
        "너는 두 출처에서 나온 신청 입력 항목을 하나의 목록으로 합치는 편집자다.",
        "결과를 아래 JSON 구조 그대로 낸다. 키 이름을 바꾸거나 새로 만들지 않는다.",
        `{ "needs": [{ "label": string, "kind": "text"|"long"|"date"|"number"|"select"|"checkbox"|"file", "required": boolean, "why": string, "source": "michael"|"research" }] }`,
        "",
        "규칙:",
        "- 같은 것을 묻는 항목은 **하나로** 합친다 (성명=이름, 연락처=휴대전화, 경력 년수=백엔드 개발 경력 등).",
        "- 합칠 때 label 은 **신청 폼(research) 쪽 글자**를 쓴다. 그게 실제로 채울 칸의 이름이다.",
        "- required 는 둘 중 하나라도 필수면 true. why 는 더 구체적인 쪽을 남긴다.",
        "- 입력 칸이 아닌 것은 버린다: 섹션 제목(기본 정보, 제출 서류), 예시 값(010-0000-0000, https://…), 안내 문장.",
        "- 새 항목을 지어내지 않는다. 순서는 폼 순서를 따른다.",
      ].join("\n"),
      prompt: [
        "공고 분석(michael):",
        ...michael.map(
          (n) => `  - ${n.label} [${n.kind}${n.required ? ", 필수" : ""}] ${n.why ?? ""}`,
        ),
        "",
        "신청 폼(research):",
        ...research.map(
          (n) => `  - ${n.label} [${n.kind}${n.required ? ", 필수" : ""}] ${n.why ?? ""}`,
        ),
      ].join("\n"),
    });

    const merged = (object.needs ?? [])
      .map((item) =>
        makeNeed({
          label: item.label,
          kind: item.kind,
          required: item.required,
          why: item.why,
          source: item.source === "michael" ? "michael" : "research",
        }),
      )
      .filter((need): need is Need => need !== null);

    // 모델이 절반을 떨어뜨렸으면 믿지 않는다. 키 병합으로 돌아간다.
    const floor = Math.min(michael.length, research.length) * 0.5;
    if (merged.length < floor) return mergeNeeds(michael, research);

    // 파일 항목은 폼에 안 보여도 남겨야 한다 — 사람이 준비할 서류 목록이다.
    // "사업계획서" 와 "사업계획서(PDF)" 는 같은 서류다. 키가 서로를 품으면 같은 것으로 본다.
    const keys = merged.map((need) => need.key);
    for (const need of michael) {
      const key = normalizeKey(need.label);
      const dup = keys.some((k) => k.includes(key) || key.includes(k));
      if (need.kind === "file" && !dup) merged.push(need);
    }
    return merged;
  } catch {
    return mergeNeeds(michael, research);
  }
}
