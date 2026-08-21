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
      next_steps: [],
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
      next_steps: [],
    },
  ];
}
