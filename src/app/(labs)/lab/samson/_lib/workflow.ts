import type { Step } from "@/lib/upstage-studio";

const SUMMARY_PROMPT = [
  "당신은 문서 요약 에이전트 Samson이다. analyze 단계에서 얻은 판단 결과만 근거로 문서의",
  "목적, 핵심 사실, 요구·결정 사항, 기한·금액·연락처 같은 실행 정보를 판단해 요약한다.",
  "응답은 반드시 하나의 완결된 Markdown 문서여야 한다. Markdown 밖의 인사말, 설명,",
  "코드 펜스는 절대 쓰지 않는다. '# 문서 요약', '## 핵심 내용', '## 실행 정보',",
  "'## 확인 필요' 섹션을 이 순서로 사용한다. 원문에 없는 정보는 추측하지 말고",
  "'정보 없음' 또는 '원문 확인 필요'로 표기한다.",
].join(" ");

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    purpose: { type: "string", description: "문서의 목적과 대상" },
    keyFacts: {
      type: "array",
      description: "문서의 핵심 사실과 결정 사항",
      items: { type: "string" },
    },
    actionItems: {
      type: "array",
      description: "독자가 해야 하는 행동과 근거",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          source: { type: "string" },
        },
      },
    },
    dates: { type: "array", items: { type: "string" } },
    amounts: { type: "array", items: { type: "string" } },
    contacts: { type: "array", items: { type: "string" } },
    unknowns: {
      type: "array",
      description: "원문에 없어 확인이 필요한 항목",
      items: { type: "string" },
    },
  },
} as const;

export function samsonWorkflow(): Step[] {
  return [
    {
      name: "parse",
      type: "document-parse",
      data: {
        ocr: "auto",
        lang: "ko",
        merge_multipage_tables: true,
        output_formats: ["html", "markdown"],
      },
      is_first: true,
      next_steps: [{ step_name: "analyze" }],
    },
    {
      name: "analyze",
      type: "information-extract",
      data: {
        confidence: true,
        mode: "enhanced",
        text: {
          format: {
            type: "json_schema",
            name: "samson_analysis",
            schema: ANALYSIS_SCHEMA,
          },
        },
      },
      next_steps: [{ step_name: "summarize" }],
    },
    {
      name: "summarize",
      type: "instruct",
      data: {
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: SUMMARY_PROMPT }],
          },
        ],
      },
      next_steps: [],
    },
  ];
}
