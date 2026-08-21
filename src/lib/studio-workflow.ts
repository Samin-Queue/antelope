import type { Step } from "@/lib/upstage-studio";
import {
  CATEGORIES,
  CATEGORY_HINT,
  CATEGORY_LABEL,
} from "@/app/(labs)/lab/notice/_lib/categories";

/**
 * Studio 워크플로 정의.
 *
 * Config 를 코드로 둔다. UI 로 클릭해 만들면 레포에 안 남고 리뷰도 못 한다.
 * 여기 있으면 워크플로가 diff 로 보이고 재현 가능하다.
 *
 * ⚠ 스키마 제약 (어기면 400):
 *   - 1단계 properties 에 object 금지 → array of object 로 감싼다
 *   - 최대 깊이 3: root → array → object → primitive
 *   - property 이름은 `_` 로 시작 금지
 */

/** 분류 스키마. description 에 경계 판정 규칙을 넣는 게 정확도를 좌우한다. */
function classifySchema() {
  return {
    type: "string",
    oneOf: CATEGORIES.map((value) => ({
      const: value,
      description: `${CATEGORY_LABEL[value]}. ${CATEGORY_HINT[value]}`,
    })),
  };
}

/**
 * 추출 스키마.
 *
 * 공통 슬롯은 평평하게 펴고, 목록형은 array of object 로 감싼다.
 * 분류마다 강조점이 다르므로 emphasis 로 설명만 바꿔 재사용한다.
 */
function extractSchema(emphasis: string) {
  return {
    type: "object",
    properties: {
      title: { type: "string", description: "공고 제목" },
      organization: { type: "string", description: "주관 기관 또는 회사명" },
      target: { type: "string", description: "지원 대상" },
      deadline: {
        type: "string",
        description: "접수 마감일. YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm",
      },
      budget: { type: "string", description: "지원 규모·급여·혜택. 원문 표현 그대로" },
      howToApply: { type: "string", description: "신청 방법과 접수처" },
      actionRequired: {
        type: "string",
        description: "신청자가 실제로 해야 하는 행동. 서류 발급, 댓글 작성 등",
      },
      requirements: {
        type: "array",
        description: `자격 요건. 항목마다 한 문장. ${emphasis}`,
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "요건 한 문장" },
            source: { type: "string", description: "원문에서 근거가 된 문장 그대로" },
          },
        },
      },
      documents: {
        type: "array",
        description: "제출 서류 목록",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "서류 이름" },
            formName: { type: "string", description: "지정 양식 이름이 있으면" },
          },
        },
      },
      scoring: {
        type: "array",
        description: "평가 항목과 배점",
        items: {
          type: "object",
          properties: {
            criterion: { type: "string" },
            points: { type: "number" },
          },
        },
      },
    },
  };
}

const INSTRUCT_PROMPT = [
  "추출 결과를 검토하고, 원문에서 확인되지 않아 신청자가 직접 확인해야 하는 항목만",
  "나열하라. 추출된 값에 이미 담긴 내용은 넣지 않는다. 원문에 없는 내용을 지어내지",
  "않는다. 한국어로, 항목당 한 줄로 쓴다.",
].join(" ");

/**
 * 분기 DAG.
 *
 * 요청마다 에이전트를 새로 만들 필요가 없다 — classify 결과로 분기하는 것이
 * Config 의 존재 이유다. 성격이 크게 다른 셋만 전용 extract 로 보내고 나머지는
 * 공통 경로를 탄다. 스텝을 13개로 늘리면 관리만 어려워지고 정확도는 안 오른다.
 */
export function noticeWorkflow(): Step[] {
  const BRANCHES = [
    {
      step: "extract-contract",
      category: "CONTRACT_TERMS",
      emphasis: "의무 조항과 기한, 위약 조건을 빠뜨리지 않는다.",
    },
    {
      step: "extract-housing",
      category: "HOUSING_SUBSCRIPTION",
      emphasis: "소득·자산 기준과 순위·가점 산정 방식을 그대로 옮긴다.",
    },
    {
      step: "extract-job",
      category: "JOB_POSTING",
      emphasis: "자격·우대사항과 전형 절차를 나눠 담는다.",
    },
  ] as const;

  return [
    {
      name: "parse",
      type: "document-parse",
      data: {
        ocr: "auto",
        coordinates: true,
        lang: "ko",
        merge_multipage_tables: true,
        output_formats: ["html", "markdown", "text"],
      },
      is_first: true,
      next_steps: [{ step_name: "classify" }],
    },
    {
      name: "classify",
      type: "document-classify",
      data: {
        confidence: true,
        // 한 파일에 여러 문서가 섞여 있으면 분류별로 쪼개 각각 흘려보낸다.
        split: true,
        text: {
          format: {
            type: "json_schema",
            name: "document_classify",
            schema: classifySchema(),
          },
        },
      },
      next_steps: [
        ...BRANCHES.map((branch) => ({
          step_name: branch.step,
          // ⚠ 필드는 반드시 "text" 다. 문서 예시의 document_type 은 400 을 낸다:
          //   "condition must use field 'text' and operator '==' with a leaf label"
          condition: {
            field: "text",
            operator: "==" as const,
            value: branch.category,
          },
        })),
        { step_name: "extract-general" },
      ],
    },
    ...BRANCHES.map((branch) => ({
      name: branch.step,
      type: "information-extract" as const,
      data: {
        confidence: true,
        location: true,
        mode: "enhanced",
        text: {
          format: {
            type: "json_schema",
            name: "notice_extract",
            schema: extractSchema(branch.emphasis),
          },
        },
      },
      next_steps: [{ step_name: "gaps" }],
    })),
    {
      name: "extract-general",
      type: "information-extract",
      data: {
        confidence: true,
        location: true,
        text: {
          format: {
            type: "json_schema",
            name: "notice_extract",
            schema: extractSchema("자격 요건과 제출 서류를 빠짐없이 담는다."),
          },
        },
      },
      next_steps: [{ step_name: "gaps" }],
    },
    {
      name: "gaps",
      type: "instruct",
      // ⚠ prompt 가 아니라 input 배열이다. prompt 로 주면
      //   "queries are required for instruct" 로 job 이 실패한다.
      // 앞 스텝(extract) 결과는 자동으로 컨텍스트에 실린다.
      data: {
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: INSTRUCT_PROMPT }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "gaps",
            schema: {
              type: "object",
              properties: {
                unknowns: {
                  type: "array",
                  description: "신청자가 직접 확인해야 하는 항목",
                  items: { type: "string" },
                },
              },
            },
          },
        },
      },
      next_steps: [],
    },
  ];
}
