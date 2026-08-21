import { z } from "zod";

import { CATEGORIES, isCategory, type Category } from "./categories";

/**
 * 정규화된 「공고 객체」.
 *
 * 이 제품의 척추다. 입력이 HWP 든 URL 이든 자연어든 전부 이 모양으로 수렴시키고,
 * 이후 파이프라인(자격 판정·준비물·초안)은 입력 종류를 알 필요가 없다.
 *
 * 스키마가 두 벌인 이유: LLM 은 값이 없으면 키를 **생략**한다. 추출용은 전부
 * 선택으로 느슨하게 받고(extractionSchema), 그 뒤 normalize 로 확정 모양을 만든다.
 * 추출 단계에서 엄격하게 굴면 필드 하나 빠졌다고 전체가 실패한다.
 */
const optionalText = z.string().nullish();

export const extractionSchema = z.object({
  category: z.enum(CATEGORIES).nullish(),
  title: optionalText,
  organization: optionalText,
  target: optionalText,
  requirements: z.array(z.object({ text: z.string(), source: optionalText })).nullish(),
  documents: z
    .array(
      z.object({
        name: z.string(),
        formName: optionalText,
        required: z.boolean().nullish(),
        note: optionalText,
      }),
    )
    .nullish(),
  deadline: optionalText.describe("YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm"),
  budget: optionalText,
  scoring: z
    .array(z.object({ criterion: z.string(), points: z.number().nullish() }))
    .nullish(),
  howToApply: optionalText,
  confidence: z.enum(["high", "medium", "low"]).nullish(),
  unknowns: z.array(z.string()).nullish(),
});

export type Extraction = z.infer<typeof extractionSchema>;

export type Requirement = {
  text: string;
  /** 공고 원문에서 이 요건이 나온 대목. 근거 없이 판정하지 않는다 */
  source: string | null;
};

export type SubmissionDocument = {
  name: string;
  formName: string | null;
  required: boolean;
  note: string | null;
};

export type ScoringItem = { criterion: string; points: number | null };

export type Notice = {
  /** Studio Classify 노드가 정한 분류. 뒤 단계가 이걸 참고한다 */
  category: Category;
  title: string;
  organization: string | null;
  target: string | null;
  requirements: Requirement[];
  documents: SubmissionDocument[];
  deadline: string | null;
  budget: string | null;
  scoring: ScoringItem[];
  howToApply: string | null;
  confidence: "high" | "medium" | "low";
  /** 원문에서 확인되지 않아 신청자가 채워야 하는 항목 */
  unknowns: string[];
};

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** 느슨한 추출 결과를 확정 모양으로 만든다. 「모른다」와 「없다」를 구분해 남긴다. */
export function normalize(raw: Extraction, fallbackTitle: string): Notice {
  const unknowns = new Set(raw.unknowns?.filter(Boolean) ?? []);
  if (!clean(raw.deadline)) unknowns.add("접수 마감일");
  if (!raw.requirements?.length) unknowns.add("신청 자격 요건");
  if (!raw.documents?.length) unknowns.add("제출 서류");

  return {
    category: isCategory(raw.category) ? raw.category : "OTHER",
    title: clean(raw.title) ?? fallbackTitle,
    organization: clean(raw.organization),
    target: clean(raw.target),
    requirements: (raw.requirements ?? [])
      .filter((item) => clean(item.text))
      .map((item) => ({ text: item.text.trim(), source: clean(item.source) })),
    documents: (raw.documents ?? [])
      .filter((item) => clean(item.name))
      .map((item) => ({
        name: item.name.trim(),
        formName: clean(item.formName),
        required: item.required ?? true,
        note: clean(item.note),
      })),
    deadline: clean(raw.deadline),
    budget: clean(raw.budget),
    scoring: (raw.scoring ?? [])
      .filter((item) => clean(item.criterion))
      .map((item) => ({ criterion: item.criterion.trim(), points: item.points ?? null })),
    howToApply: clean(raw.howToApply),
    confidence: raw.confidence ?? "low",
    unknowns: [...unknowns],
  };
}
