/**
 * 실험 레지스트리.
 *
 * 트랙 확정 전까지 아이디어를 병렬로 찔러보고 아니다 싶으면 즉시 버린다.
 * 실험 하나 = `src/app/(labs)/lab/<slug>/` 폴더 하나. 폴더를 지우면 실험이 사라진다.
 *
 * 규칙:
 * - 실험 코드는 자기 폴더 안에만 둔다. `src/lib/*` 를 고치지 않는다 — 버릴 때 안전해야 한다
 * - 공용 부품(shadcn, llm.ts, upstage.ts, db)은 **읽어서 쓰기만** 한다
 * - 어떤 부품이 두 실험에서 쓰이고 검증되면 그때 `src/lib` 으로 승격한다
 * - DB 가 필요하면 새 테이블 대신 documents.raw(jsonb) 를 쓴다. 스키마를 늘리지 않는다
 */
export type LabStatus = "exploring" | "promising" | "dropped";

export type Lab = {
  slug: string;
  title: string;
  /** 한 문장. 무엇을 검증하려는 실험인가 */
  hypothesis: string;
  status: LabStatus;
  owner: string;
};

export const LAB_STATUS_LABEL: Record<LabStatus, string> = {
  exploring: "탐색 중",
  promising: "유력",
  dropped: "폐기",
};

export const labs: Lab[] = [
  {
    slug: "notice",
    title: "공고 → 신청 준비 일습",
    hypothesis:
      "파일·링크·자연어 무엇으로 넣어도 하나의 「공고 객체」로 수렴시키고, 제출 직전 상태까지 자동으로 채울 수 있는가",
    status: "exploring",
    owner: "승욱",
  },
  {
    slug: "validation",
    title: "유효성 검사 · 문서 요약",
    hypothesis:
      "무작위 문서를 Parse → 판단 → 하나의 Markdown 요약으로 안정적으로 압축할 수 있는가",
    status: "exploring",
    owner: "Samin Queue",
  },
  {
    slug: "analysis",
    title: "정보 분석 · 신청 양식 설계",
    hypothesis: "여러 문서를 분류해 신청 유형별 JSON 필드 목록으로 만들 수 있는가",
    status: "exploring",
    owner: "Samin Queue",
  },
  {
    slug: "crawler",
    title: "공고 수집기",
    hypothesis: "공식 출처의 공고를 URL·원문·캡처와 함께 카드로 축적할 수 있는가",
    status: "exploring",
    owner: "Samin Queue",
  },
];
