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
  // 예시. 실제 실험을 추가하면 이 줄은 지운다.
  // {
  //   slug: "notice",
  //   title: "공고문 → 신청 준비 일습",
  //   hypothesis: "HWP 공고문에서 자격요건·제출서류를 뽑아 제출 직전 상태까지 자동 완성할 수 있는가",
  //   status: "exploring",
  //   owner: "승욱",
  // },
];
