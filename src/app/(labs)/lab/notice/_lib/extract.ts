import { generateObject } from "ai";

import { chatModel } from "@/lib/llm";
import { parseDocument } from "@/lib/upstage";

import { CATEGORIES, CATEGORY_LABEL } from "./categories";
import { extractionSchema, normalize, type Notice } from "./schema";

/** 프롬프트에 박을 분류 목록. Studio Classify 와 같은 값이어야 한다. */
const CATEGORY_ENUM = CATEGORIES.map((value) => `"${value}"`).join(" | ");

export type IngestSource =
  { kind: "file"; name: string } | { kind: "url"; url: string } | { kind: "text" };

/** 어떤 입력이든 먼저 평문으로 만든다. 파싱 책임을 여기 한 곳에 모은다. */
export async function toPlainText(
  input: File | string,
  kind: "file" | "url" | "text",
): Promise<{ text: string; via: string }> {
  if (kind === "text") {
    return { text: input as string, via: "plain" };
  }

  if (kind === "file") {
    const parsed = await parseDocument(input as File, {
      outputFormats: ["markdown"],
    });
    const text = parsed.content?.markdown ?? parsed.content?.text ?? "";
    return { text, via: "upstage/document-parse" };
  }

  // URL — 본문이 문서 파일이면 다시 Document Parse 로 넘긴다.
  const url = input as string;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AntelopeBot/0.1)" },
    redirect: "follow",
  });
  if (!response.ok)
    throw new Error(`URL 을 가져오지 못했습니다 (HTTP ${response.status})`);

  const contentType = response.headers.get("content-type") ?? "";
  const isDocument =
    /pdf|hwp|msword|officedocument|haansoft/i.test(contentType) ||
    /\.(pdf|hwp|hwpx|docx|xlsx|pptx)(\?|$)/i.test(url);

  if (isDocument) {
    const blob = await response.blob();
    const parsed = await parseDocument(blob, { outputFormats: ["markdown"] });
    return {
      text: parsed.content?.markdown ?? "",
      via: "fetch → upstage/document-parse",
    };
  }

  const html = await response.text();
  return { text: htmlToText(html), via: "fetch → html" };
}

/** 의존성 없이 본문만 남긴다. 정확도보다 견고함을 택했다. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 모델 컨텍스트를 넘기지 않도록 자른다. 공고문은 앞부분에 핵심이 몰려 있다. */
const MAX_CHARS = 40_000;

export async function extractNotice(text: string, source: IngestSource): Promise<Notice> {
  const trimmed = text.slice(0, MAX_CHARS);

  // Upstage 의 json_object 모드는 스키마를 전달받지 않는다. 명시하지 않으면 모델이
  // organizer·eligibility 처럼 제 마음대로 필드명을 지어내 검증이 통째로 실패한다.
  // 계약을 프롬프트에 직접 박는다.
  const FIELD_CONTRACT = `{
  "category": ${CATEGORY_ENUM},
  "title": string,
  "organization": string | null,
  "target": string | null,
  "requirements": [{ "text": string, "source": string | null }],
  "documents": [{ "name": string, "formName": string | null, "required": boolean, "note": string | null }],
  "deadline": string | null,
  "budget": string | null,
  "scoring": [{ "criterion": string, "points": number | null }],
  "howToApply": string | null,
  "confidence": "high" | "medium" | "low",
  "unknowns": [string]
}`;

  const { object } = await generateObject({
    model: chatModel(),
    schema: extractionSchema,
    system: [
      "너는 한국의 지원사업·모집 공고를 구조화된 JSON 으로 변환하는 분석기다.",
      "",
      "아래 키 이름과 구조를 **그대로** 쓴다. 키를 새로 만들거나 이름을 바꾸지 않는다.",
      "중첩 객체를 임의로 추가하지 않는다.",
      FIELD_CONTRACT,
      "",
      "규칙:",
      "- category 는 아래 중 하나를 고른다. 애매하면 OTHER 로 둔다.",
      ...CATEGORIES.map((value) => `    ${value} — ${CATEGORY_LABEL[value]}`),
      "- 원문에 없는 내용을 지어내지 않는다. 확인되지 않는 값은 null 로 둔다.",
      "- requirements 는 자격 요건을 한 문장씩 나눠 담는다. 제외 대상도 요건이다.",
      "- 각 요건의 source 에는 원문 문장을 그대로 옮긴다. 요약하지 않는다.",
      "- documents 는 제출 서류를 하나씩 담는다. 지정 양식이 있으면 formName 에 적는다.",
      "- deadline 은 YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm 으로 정규화한다.",
      "- 원문에서 확인되지 않아 신청자가 직접 확인해야 하는 항목만 unknowns 에 넣는다.",
      "  requirements·documents 에 이미 담은 내용을 unknowns 에 중복해 넣지 않는다.",
      "- confidence: 정식 공고문이면 high, 웹페이지 본문이면 medium, 말로 설명한 것이면 low.",
    ].join("\n"),
    prompt: [
      `입력 종류: ${source.kind}`,
      source.kind === "url" ? `출처: ${source.url}` : "",
      source.kind === "file" ? `파일명: ${source.name}` : "",
      "",
      "--- 원문 ---",
      trimmed,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const fallbackTitle =
    source.kind === "file"
      ? source.name
      : source.kind === "url"
        ? source.url
        : "제목 미상";
  return normalize(object, fallbackTitle);
}
