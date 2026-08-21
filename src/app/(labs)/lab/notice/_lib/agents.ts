import { generateObject } from "ai";
import { z } from "zod";

import { chatModel } from "@/lib/llm";

import type { Notice } from "./schema";

/**
 * 서브에이전트들.
 *
 * 각자 하나의 판단만 한다. 오케스트레이터가 병렬로 굴리고 결과를 합친다.
 *
 * ⚠ Upstage 는 스키마를 모델에 전달하지 않는다. 모든 프롬프트에 필드 계약을
 * 직접 박고, 스키마는 `.nullish()` 로 느슨하게 받아 뒤에서 정규화한다.
 * (자세한 배경은 AGENTS.md "Upstage 구조화 출력의 함정")
 */

export type Profile = Record<string, string>;

const profileText = (profile: Profile) =>
  Object.entries(profile)
    .map(([key, value]) => `  ${key}: ${value}`)
    .join("\n") || "  (제공된 정보 없음)";

// ── 1. 자격 판정 ────────────────────────────────────────────────────────
const verdictSchema = z.object({
  verdicts: z
    .array(
      z.object({
        requirement: z.string(),
        status: z.enum(["meets", "fails", "unknown"]).nullish(),
        reason: z.string().nullish(),
        /** 판정하려면 신청자에게 무엇을 더 물어야 하는가 */
        needsFromUser: z.string().nullish(),
      }),
    )
    .nullish(),
  overall: z.enum(["eligible", "ineligible", "unclear"]).nullish(),
});

export type Eligibility = {
  verdicts: Array<{
    requirement: string;
    status: "meets" | "fails" | "unknown";
    reason: string | null;
    needsFromUser: string | null;
  }>;
  overall: "eligible" | "ineligible" | "unclear";
};

export async function judgeEligibility(
  notice: Notice,
  profile: Profile,
): Promise<Eligibility> {
  const { object } = await generateObject({
    model: chatModel(),
    schema: verdictSchema,
    system: [
      "너는 지원사업 자격 요건을 신청자 정보와 대조해 판정하는 심사 보조자다.",
      "결과를 아래 JSON 구조 그대로 낸다. 키 이름을 바꾸거나 새로 만들지 않는다.",
      `{ "verdicts": [{ "requirement": string, "status": "meets"|"fails"|"unknown", "reason": string, "needsFromUser": string|null }], "overall": "eligible"|"ineligible"|"unclear" }`,
      "",
      "규칙:",
      "- 신청자 정보로 확인할 수 없으면 반드시 unknown 이다. 추측해서 meets 로 만들지 않는다.",
      "- unknown 이면 needsFromUser 에 무엇을 확인해야 하는지 한 문장으로 적는다.",
      "- reason 은 왜 그렇게 판정했는지 한 문장. 공고 원문의 표현을 근거로 든다.",
      "- 하나라도 fails 면 overall 은 ineligible, 하나라도 unknown 이면 unclear 다.",
    ].join("\n"),
    prompt: [
      `공고: ${notice.title}`,
      notice.target ? `지원 대상: ${notice.target}` : "",
      "",
      "자격 요건:",
      ...notice.requirements.map(
        (item, index) =>
          `  ${index + 1}. ${item.text}` +
          (item.source ? `\n     (원문: ${item.source})` : ""),
      ),
      "",
      "신청자 정보:",
      profileText(profile),
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const verdicts = (object.verdicts ?? [])
    .filter((item) => item.requirement?.trim())
    .map((item) => ({
      requirement: item.requirement.trim(),
      status: item.status ?? "unknown",
      reason: item.reason?.trim() || null,
      needsFromUser: item.needsFromUser?.trim() || null,
    }));

  const overall =
    object.overall ??
    (verdicts.some((v) => v.status === "fails")
      ? "ineligible"
      : verdicts.some((v) => v.status === "unknown")
        ? "unclear"
        : "eligible");

  return { verdicts, overall };
}

// ── 2. 제출서류 준비 계획 ────────────────────────────────────────────────
const planSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string(),
        origin: z.enum(["hold", "issue", "write"]).nullish(),
        how: z.string().nullish(),
        canAutomate: z.boolean().nullish(),
        estimatedMinutes: z.number().nullish(),
      }),
    )
    .nullish(),
});

export type DocumentPlan = {
  items: Array<{
    name: string;
    origin: "hold" | "issue" | "write";
    how: string | null;
    canAutomate: boolean;
    estimatedMinutes: number | null;
  }>;
};

export async function planDocuments(notice: Notice): Promise<DocumentPlan> {
  const { object } = await generateObject({
    model: chatModel(),
    schema: planSchema,
    system: [
      "너는 한국 지원사업의 제출 서류를 어떻게 확보하는지 안내하는 실무 보조자다.",
      "결과를 아래 JSON 구조 그대로 낸다. 키 이름을 바꾸거나 새로 만들지 않는다.",
      `{ "items": [{ "name": string, "origin": "hold"|"issue"|"write", "how": string, "canAutomate": boolean, "estimatedMinutes": number }] }`,
      "",
      "origin 의 뜻:",
      "  hold  — 신청자가 이미 갖고 있을 서류 (신분증 사본 등)",
      "  issue — 기관에서 발급받아야 하는 서류 (사업자등록증명, 등기부등본 등)",
      "  write — 직접 작성해야 하는 서류 (사업계획서 등)",
      "",
      "규칙:",
      "- how 에는 어디서 어떻게 확보하는지 한 문장. 한국 실무 기준으로 구체적으로 적는다.",
      "  (예: 정부24에서 온라인 발급, 홈택스에서 즉시 출력)",
      "- canAutomate 는 우리 서비스가 대신 채워줄 수 있는 서류인지 여부다. write 계열이 주로 true.",
      "- estimatedMinutes 는 그 서류 하나를 확보하는 데 걸리는 대략 시간(분).",
    ].join("\n"),
    prompt: [
      `공고: ${notice.title}`,
      "",
      "제출 서류:",
      ...notice.documents.map(
        (item, index) =>
          `  ${index + 1}. ${item.name}` +
          (item.formName ? ` (지정 양식: ${item.formName})` : "") +
          (item.required ? "" : " [해당 시]"),
      ),
    ].join("\n"),
  });

  return {
    items: (object.items ?? [])
      .filter((item) => item.name?.trim())
      .map((item) => ({
        name: item.name.trim(),
        origin: item.origin ?? "hold",
        how: item.how?.trim() || null,
        canAutomate: item.canAutomate ?? false,
        estimatedMinutes: item.estimatedMinutes ?? null,
      })),
  };
}

// ── 3. 평가배점에 맞춘 신청서 개요 ───────────────────────────────────────
const outlineSchema = z.object({
  sections: z
    .array(
      z.object({
        heading: z.string(),
        points: z.number().nullish(),
        /** 이 항목에서 심사자가 보고 싶어하는 것 */
        whatTheyWant: z.string().nullish(),
        bullets: z.array(z.string()).nullish(),
      }),
    )
    .nullish(),
});

export type Outline = {
  sections: Array<{
    heading: string;
    points: number | null;
    whatTheyWant: string | null;
    bullets: string[];
  }>;
};

export async function draftOutline(notice: Notice, profile: Profile): Promise<Outline> {
  const { object } = await generateObject({
    model: chatModel(),
    schema: outlineSchema,
    system: [
      "너는 지원사업 신청서를 평가 배점에 맞춰 설계하는 보조자다.",
      "결과를 아래 JSON 구조 그대로 낸다. 키 이름을 바꾸거나 새로 만들지 않는다.",
      `{ "sections": [{ "heading": string, "points": number|null, "whatTheyWant": string, "bullets": [string] }] }`,
      "",
      "규칙:",
      "- 평가 배점이 있으면 배점 항목마다 섹션을 하나씩 만들고 points 를 채운다.",
      "- 배점이 없으면 일반적인 사업계획서 구성으로 만든다.",
      "- bullets 는 그 섹션에 무엇을 쓸지 3~4개. 신청자 정보에 근거해 구체적으로 쓴다.",
      "- 신청자 정보에 없는 사실을 지어내지 않는다. 필요한데 없으면 '(확인 필요: …)' 로 표시한다.",
    ].join("\n"),
    prompt: [
      `공고: ${notice.title}`,
      notice.budget ? `지원 규모: ${notice.budget}` : "",
      "",
      notice.scoring.length
        ? [
            "평가 배점:",
            ...notice.scoring.map((s) => `  ${s.criterion} ${s.points ?? "?"}점`),
          ].join("\n")
        : "평가 배점: 공고에 명시되지 않음",
      "",
      "신청자 정보:",
      profileText(profile),
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return {
    sections: (object.sections ?? [])
      .filter((item) => item.heading?.trim())
      .map((item) => ({
        heading: item.heading.trim(),
        points: item.points ?? null,
        whatTheyWant: item.whatTheyWant?.trim() || null,
        bullets: (item.bullets ?? []).filter(Boolean),
      })),
  };
}

// ── 4. 이 공고에 필요한 정보만 도출 ─────────────────────────────────────
const fieldsSchema = z.object({
  fields: z
    .array(
      z.object({
        key: z.string(),
        why: z.string().nullish(),
        kind: z.enum(["text", "date", "number", "money", "long"]).nullish(),
        placeholder: z.string().nullish(),
        required: z.boolean().nullish(),
      }),
    )
    .nullish(),
});

export type RequiredField = {
  key: string;
  /** 왜 묻는지. 공고의 어느 요건·배점 때문인지 */
  why: string | null;
  kind: "text" | "date" | "number" | "money" | "long";
  placeholder: string | null;
  required: boolean;
};

/**
 * 공고마다 필요한 정보가 다르다. 고정 폼으로 항상 같은 걸 묻는 건 낭비이고,
 * 정작 그 공고에 필요한 항목은 안 물어보게 된다.
 */
export async function deriveFields(notice: Notice): Promise<RequiredField[]> {
  const { object } = await generateObject({
    model: chatModel(),
    schema: fieldsSchema,
    system: [
      "너는 지원사업 공고를 읽고 신청자에게 무엇을 물어야 하는지 정하는 설계자다.",
      "결과를 아래 JSON 구조 그대로 낸다. 키 이름을 바꾸거나 새로 만들지 않는다.",
      `{ "fields": [{ "key": string, "why": string, "kind": "text"|"date"|"number"|"money"|"long", "placeholder": string, "required": boolean }] }`,
      "",
      "규칙:",
      "- **이 공고를 판정하거나 작성하는 데 실제로 필요한 항목만** 넣는다. 일반적인 회사 정보를 나열하지 않는다.",
      "- 자격 요건마다 그것을 확인할 항목이 있어야 한다. (예: '만 39세 이하' → 생년월일)",
      "- 평가 배점에 필요한 항목도 넣는다. (예: '고용창출 효과' → 현재 직원수, 채용 계획)",
      "- why 에는 공고의 어느 요건·배점 때문에 묻는지 한 문장으로 적는다.",
      "- key 는 한국어 명사구로 짧게. (예: 생년월일, 상시근로자 수)",
      "- required 는 그 항목 없이는 판정이 불가능한 경우에만 true.",
      "- 최대 8개. 많을수록 신청자가 이탈한다.",
    ].join("\n"),
    prompt: [
      `공고: ${notice.title}`,
      notice.target ? `지원 대상: ${notice.target}` : "",
      "",
      "자격 요건:",
      ...notice.requirements.map((item, index) => `  ${index + 1}. ${item.text}`),
      "",
      notice.scoring.length
        ? [
            "평가 배점:",
            ...notice.scoring.map((s) => `  ${s.criterion} ${s.points ?? "?"}점`),
          ].join("\n")
        : "평가 배점: 명시되지 않음",
      "",
      notice.documents.length
        ? ["제출 서류:", ...notice.documents.map((d) => `  ${d.name}`)].join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return (object.fields ?? [])
    .filter((item) => item.key?.trim())
    .slice(0, 8)
    .map((item) => ({
      key: item.key.trim(),
      why: item.why?.trim() || null,
      kind: item.kind ?? "text",
      placeholder: item.placeholder?.trim() || null,
      required: item.required ?? false,
    }));
}
