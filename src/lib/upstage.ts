import { meteredFetch } from "@/lib/ai/meter";
import { required } from "@/lib/env";

/**
 * Upstage Document AI 얇은 래퍼.
 * base: https://api.upstage.ai/v1  ·  auth: Authorization: Bearer <key>
 *
 * 채팅/임베딩은 OpenAI 호환이라 src/lib/llm.ts 가 담당한다.
 * 여기는 OpenAI 규격에 없는 문서 API 만 다룬다.
 */
const BASE = "https://api.upstage.ai/v1";

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${required("UPSTAGE_API_KEY")}` };
}

async function post(
  path: string,
  body: BodyInit,
  extraHeaders: Record<string, string> = {},
) {
  // Document Parse·임베딩도 청구된다. 원장에 안 들어가면 「무엇이 비싼가」의
  // 절반이 안 보인다 — 이 API 는 AI SDK 를 안 타므로 여기서 직접 건다.
  const response = await meteredFetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...authHeader(), ...extraHeaders },
    body,
  });
  if (!response.ok) {
    throw new Error(`[upstage] ${path} ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

/** Document Parse 응답에서 우리가 쓰는 부분만. */
export type ParsedDocument = {
  content?: { html?: string; markdown?: string; text?: string };
  elements?: Array<{
    id?: number;
    page?: number;
    category?: string;
    content?: { html?: string; markdown?: string; text?: string };
  }>;
  usage?: { pages?: number };
};

export type ParseOptions = {
  /** "document-parse" (안정) 또는 "document-parse-nightly" (enhanced 모드용) */
  model?: string;
  /** 복잡한 표·차트·이미지가 많은 문서는 "enhanced" */
  mode?: "default" | "enhanced";
  /** 반환 포맷. 기본 html + markdown */
  outputFormats?: Array<"html" | "markdown" | "text">;
  ocr?: "auto" | "force";
};

/** PDF·이미지·DOCX·PPTX·XLSX·HWP → 구조화된 HTML/Markdown */
export async function parseDocument(
  file: File | Blob,
  options: ParseOptions = {},
): Promise<ParsedDocument> {
  const form = new FormData();
  form.append("document", file);
  form.append("model", options.model ?? "document-parse");
  form.append(
    "output_formats",
    JSON.stringify(options.outputFormats ?? ["html", "markdown"]),
  );
  if (options.mode) form.append("mode", options.mode);
  if (options.ocr) form.append("ocr", options.ocr);

  return post("/document-digitization", form) as Promise<ParsedDocument>;
}

/** 순수 텍스트만 필요할 때 */
export async function ocrDocument(file: File | Blob): Promise<{ text?: string }> {
  const form = new FormData();
  form.append("document", file);
  form.append("model", "ocr");
  return post("/document-digitization", form) as Promise<{ text?: string }>;
}

/**
 * Information Extraction — 임의의 JSON 스키마로 문서에서 필드를 뽑는다.
 * schema 는 JSON Schema object (properties 를 가진 type:"object").
 */
export async function extractInformation<T = unknown>(
  file: File | Blob,
  schema: Record<string, unknown>,
  schemaName = "document_schema",
): Promise<T> {
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mime = (file as File).type || "application/octet-stream";

  const payload = {
    model: "information-extract",
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: schemaName, schema },
    },
  };

  const result = (await post("/information-extraction", JSON.stringify(payload), {
    "Content-Type": "application/json",
  })) as { choices?: Array<{ message?: { content?: string } }> };

  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("[upstage] information-extraction: 빈 응답");
  return JSON.parse(content) as T;
}

/** Upstage 임베딩 모델. 질의와 문서에 서로 다른 모델을 쓴다. */
export const EMBEDDING_MODELS = {
  query: "solar-embedding-2-query",
  passage: "solar-embedding-2-passage",
} as const;

/**
 * 텍스트 배열을 1024차원 벡터로 변환한다.
 * 저장할 문서는 "passage", 검색어는 "query" 를 쓴다 — 섞으면 정확도가 떨어진다.
 */
export async function embed(
  input: string[],
  kind: keyof typeof EMBEDDING_MODELS = "passage",
): Promise<number[][]> {
  if (input.length === 0) return [];

  const result = (await post(
    "/embeddings",
    JSON.stringify({ model: EMBEDDING_MODELS[kind], input }),
    { "Content-Type": "application/json" },
  )) as { data?: Array<{ index: number; embedding: number[] }> };

  const data = result.data;
  if (!data) throw new Error("[upstage] embeddings: 빈 응답");

  // API 가 순서를 보장하지 않을 수 있어 index 로 재정렬한다.
  return [...data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
}
