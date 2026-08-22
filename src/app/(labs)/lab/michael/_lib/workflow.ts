import type { Step } from "@/lib/upstage-studio";

const APPLICATION_TYPES = [
  "JOB_APPLICATION",
  "SCHOLARSHIP_APPLICATION",
  "HOUSING_APPLICATION",
  "COMPETITION_ENTRY",
  "GRANT_SUPPORT_APPLICATION",
  "PERMIT_APPLICATION",
  "GENERAL_APPLICATION",
] as const;

function classificationSchema() {
  return {
    type: "string",
    oneOf: APPLICATION_TYPES.map((value) => ({
      const: value,
      description: `${value}에 필요한 신청 양식 필드를 만든다.`,
    })),
  };
}

function fieldSchema(emphasis: string) {
  return {
    type: "object",
    properties: {
      applicationType: {
        type: "string",
        description: "분류된 신청 유형. 대문자 스네이크케이스",
      },
      applicationTitle: { type: "string", description: "신청 공고 또는 양식의 제목" },
      fields: {
        type: "array",
        description: `신청 양식에 필요한 필드만 순서대로 정리한다. ${emphasis}`,
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "영문 camelCase 필드 키" },
            label: { type: "string", description: "사용자에게 보일 한글 필드명" },
            inputType: {
              type: "string",
              description: "TEXT | TEXTAREA | DATE | NUMBER | SELECT | CHECKBOX | FILE",
            },
            required: { type: "boolean", description: "공고상 필수 여부" },
            stage: {
              type: "string",
              description:
                "BASIC | ELIGIBILITY | DOCUMENTS | ESSAY | REVIEW | SUBMISSION",
            },
            documentName: {
              type: "string",
              description: "FILE이면 제출 서류 이름, 아니면 빈 문자열",
            },
            formName: { type: "string", description: "지정 양식 이름, 없으면 빈 문자열" },
            instructions: {
              type: "string",
              description: "작성 또는 제출 제약. 없으면 빈 문자열",
            },
            source: { type: "string", description: "필드를 요구한 원문 문장" },
          },
        },
      },
    },
  };
}

/**
 * 마지막 스텝 이름. 호출부(`analyze.ts`)가 `findStep(outputs, BRIEF)` 로 찾는다 —
 * 이름이 어긋나면 산출물이 조용히 사라진다.
 */
export const BRIEF = "brief";

/**
 * ⚠ instruct 는 `data.prompt` 가 아니라 **`data.input` 배열**이다.
 * prompt 로 주면 job 이 `queries are required` 로 실패한다.
 */
const BRIEF_INPUT = [
  {
    role: "user",
    content: [
      {
        type: "input_text",
        text: [
          "당신은 신청 준비 문서를 정돈하는 에이전트 Michael 이다.",
          "parse 로 읽은 원문과 extract 로 뽑은 필드 목록만 근거로,",
          "이 신청을 준비하는 사람이 그대로 따라갈 수 있는 하나의 Markdown 문서를 만든다.",
          "",
          "다음 섹션을 이 순서로 쓴다:",
          "'# 신청 개요' — 무엇을, 누가 주관하고, 누가 낼 수 있는지",
          "'## 자격 요건' — 항목마다 한 줄. 숫자·기간·금액은 원문 표현 그대로",
          "'## 제출 서류' — 서류명, 지정 양식이 있으면 양식 이름, 발급처를 아는 경우만",
          "'## 일정' — 접수 시작·마감, 발표, 그 밖의 기한. 날짜는 YYYY-MM-DD",
          "'## 신청 방법' — 어디서 어떻게. URL 이 원문에 있으면 그대로 옮긴다",
          "'## 입력해야 하는 항목' — extract 가 뽑은 필드를 목록으로. 필수는 (필수) 로 표기",
          "'## 확인 필요' — 원문에서 확정할 수 없었던 것",
          "",
          "Markdown 밖의 인사말·설명·코드 펜스는 절대 쓰지 않는다.",
          "원문에 없는 내용을 지어내지 않는다. 모르면 '원문 확인 필요' 라고 쓴다.",
        ].join("\n"),
      },
    ],
  },
];

export function michaelWorkflow(): Step[] {
  const branches = [
    {
      category: "JOB_APPLICATION",
      step: "extract-job",
      emphasis:
        "성명·연락처·경력·학력·자기소개서·포트폴리오·채용 서류를 빠뜨리지 않는다.",
    },
    {
      category: "SCHOLARSHIP_APPLICATION",
      step: "extract-scholarship",
      emphasis:
        "학교·학과·학번·성적·소득·추천서·장학 에세이와 증빙 서류를 빠뜨리지 않는다.",
    },
    {
      category: "HOUSING_APPLICATION",
      step: "extract-housing",
      emphasis: "세대·주소·소득·자산·청약 자격·주택 소유·증빙 서류를 빠뜨리지 않는다.",
    },
    {
      category: "COMPETITION_ENTRY",
      step: "extract-competition",
      emphasis:
        "팀 정보·참가자·작품·제안서·동의·파일 형식과 제출 기한을 빠뜨리지 않는다.",
    },
    {
      category: "GRANT_SUPPORT_APPLICATION",
      step: "extract-grant",
      emphasis: "사업자·대표자·사업 계획·예산·증빙·동의와 제출 서류를 빠뜨리지 않는다.",
    },
    {
      category: "PERMIT_APPLICATION",
      step: "extract-permit",
      emphasis: "신청인·대상 시설·주소·인허가 정보·법정 첨부 서류를 빠뜨리지 않는다.",
    },
  ] as const;

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
      next_steps: [{ step_name: "classify" }],
    },
    {
      name: "classify",
      type: "document-classify",
      data: {
        split: false,
        text: {
          format: {
            type: "json_schema",
            name: "application_type",
            schema: classificationSchema(),
          },
        },
      },
      next_steps: [
        ...branches.map((branch) => ({
          step_name: branch.step,
          condition: { field: "text", operator: "==" as const, value: branch.category },
        })),
        { step_name: "extract-general" },
      ],
    },
    ...branches.map((branch) => ({
      name: branch.step,
      type: "information-extract" as const,
      data: {
        confidence: true,
        location: true,
        mode: "enhanced",
        text: {
          format: {
            type: "json_schema",
            name: "application_fields",
            schema: fieldSchema(branch.emphasis),
          },
        },
      },
      next_steps: [{ step_name: BRIEF }],
    })),
    {
      name: "extract-general",
      type: "information-extract",
      data: {
        confidence: true,
        location: true,
        mode: "enhanced",
        text: {
          format: {
            type: "json_schema",
            name: "application_fields",
            schema: fieldSchema(
              "신청자 정보, 자격, 첨부 서류, 작성 항목을 빠뜨리지 않는다.",
            ),
          },
        },
      },
      next_steps: [{ step_name: BRIEF }],
    },
    {
      name: BRIEF,
      type: "instruct",
      data: { input: BRIEF_INPUT },
      next_steps: [],
    },
  ];
}
