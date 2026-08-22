import { z } from "zod";

import { isAbort, runObject } from "@/lib/ai/gateway";
import { noPlaceholder, uniqueBy } from "@/lib/ai/verify";

import { makeNeed, mergeNeeds, NEED_RULES, normalizeKey } from "./needs";
import type { Need } from "./types";

/**
 * 두 목록을 하나로.
 *
 * 정보 분석 은 공고에서 "성명·연락처" 를, research 는 신청 폼에서 "이름·휴대전화" 를
 * 뽑는다. 글자가 달라 키 병합으로는 못 합친다 — 같은 것을 두 번 묻는 게 가장
 * 나쁜 경험이라 모델이 한 번 더 본다. 폼 라벨이 실제로 채울 칸이므로 그 이름을
 * 남기고, 정보 분석 의 필수 여부·근거는 끌어온다. 섹션 제목·예시 값은 버린다.
 */
const schema = z.object({
  needs: z
    .array(
      z.object({
        label: z.string().nullish(),
        kind: z.string().nullish(),
        options: z.array(z.string()).nullish(),
        required: z.boolean().nullish(),
        why: z.string().nullish(),
        source: z.string().nullish(),
      }),
    )
    .nullish(),
});

export async function reconcileNeeds(
  analysis: Need[],
  research: Need[],
): Promise<Need[]> {
  if (analysis.length === 0 || research.length === 0)
    return mergeNeeds(analysis, research);

  try {
    const { value: object } = await runObject(
      { task: "reconcile" },
      {
        role: "너는 두 출처에서 나온 신청 입력 항목을 하나의 목록으로 합치는 편집자다.",
        schema,
        rules: [
          ...NEED_RULES,
          "- 같은 것을 묻는 항목은 **하나로** 합친다 (성명=이름, 연락처=휴대전화, 경력 년수=백엔드 개발 경력 등).",
          "- 합칠 때 label 은 **신청 폼(research) 쪽 글자**를 쓴다. 그게 실제로 채울 칸의 이름이다.",
          "- required 는 둘 중 하나라도 필수면 true. why 는 더 구체적인 쪽을 남긴다.",
          "- 새 항목을 지어내지 않는다. 순서는 폼 순서를 따른다.",
        ],
        verify: [
          noPlaceholder("needs[].label"),
          uniqueBy("needs[].label", (item) => normalizeKey(String(item ?? ""))),
        ],
        prompt: [
          "공고 분석(analysis):",
          ...analysis.map(
            (n) =>
              `  - ${n.label} [${n.kind}${n.required ? ", 필수" : ""}] ${n.why ?? ""}`,
          ),
          "",
          "신청 폼(research):",
          ...research.map(
            (n) =>
              `  - ${n.label} [${n.kind}${n.required ? ", 필수" : ""}] ${n.why ?? ""}`,
          ),
        ].join("\n"),
      },
    );

    const merged = (object.needs ?? [])
      .map((item) =>
        makeNeed({
          label: item.label ?? "",
          kind: item.kind,
          options: item.options,
          required: item.required,
          why: item.why,
          source: item.source === "analysis" ? "analysis" : "research",
        }),
      )
      .filter((need): need is Need => need !== null);

    // 모델이 절반을 떨어뜨렸으면 믿지 않는다. 키 병합으로 돌아간다.
    const floor = Math.min(analysis.length, research.length) * 0.5;
    if (merged.length < floor) return mergeNeeds(analysis, research);

    // 파일 항목은 폼에 안 보여도 남겨야 한다 — 사람이 준비할 서류 목록이다.
    // "사업계획서" 와 "사업계획서(PDF)" 는 같은 서류다. 키가 서로를 품으면 같은 것으로 본다.
    const keys = merged.map((need) => need.key);
    for (const need of analysis) {
      const key = normalizeKey(need.label);
      const dup = keys.some((k) => k.includes(key) || key.includes(k));
      if (need.kind === "file" && !dup) merged.push(need);
    }
    return merged;
  } catch (error) {
    if (isAbort(error)) throw error;
    return mergeNeeds(analysis, research);
  }
}
