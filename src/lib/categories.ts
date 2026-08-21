/**
 * 공고 분류.
 *
 * ⚠ 값은 Upstage Studio 의 Classify 노드에 등록한 클래스와 **글자 그대로 같아야
 * 한다.** 어느 한쪽만 바꾸면 분류 결과가 어느 분기에도 걸리지 않는다.
 * Studio 설정 절차는 docs/UPSTAGE_STUDIO_SETUP.md 참고.
 *
 * lab 실험과 랜딩·Studio 워크플로가 함께 쓰므로 `src/lib` 으로 승격했다.
 *
 * 값을 영문 대문자로 두는 이유는 이게 코드의 분기 키이기 때문이다. 한글 라벨을
 * 값으로 쓰면 표기가 조금만 달라져도 매칭이 깨진다.
 */
export const CATEGORIES = [
  "GOV_SUPPORT_PROGRAM",
  "JOB_POSTING",
  "HOUSING_SUBSCRIPTION",
  "UNIVERSITY_ADMISSION",
  "SCHOLARSHIP",
  "COMPETITION",
  "EVENT_ENTRY",
  "EXAM_CERTIFICATION",
  "PUBLIC_BENEFIT",
  "MEMBERSHIP_PROGRAM",
  "PERMIT_FILING",
  "CONTRACT_TERMS",
  "OTHER",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  GOV_SUPPORT_PROGRAM: "정부지원사업",
  JOB_POSTING: "채용 공고",
  HOUSING_SUBSCRIPTION: "임대·분양 청약",
  UNIVERSITY_ADMISSION: "대학 입시",
  SCHOLARSHIP: "장학금",
  COMPETITION: "공모전·대회",
  EVENT_ENTRY: "이벤트 응모",
  EXAM_CERTIFICATION: "자격증·시험",
  PUBLIC_BENEFIT: "정부 혜택 신청",
  MEMBERSHIP_PROGRAM: "입주·멤버십",
  PERMIT_FILING: "인허가·신고",
  CONTRACT_TERMS: "계약·약관",
  OTHER: "기타",
};

/**
 * 분류마다 신청자가 실제로 하는 일이 다르다.
 * 뒤 단계(질문 도출·서류 계획)가 이걸 참고한다.
 */
export const CATEGORY_HINT: Record<Category, string> = {
  GOV_SUPPORT_PROGRAM: "자격 요건과 평가 배점이 핵심이다. 지정 양식 서류가 많다.",
  JOB_POSTING: "자격·우대사항과 전형 절차가 핵심이다. 이력서·포트폴리오를 낸다.",
  HOUSING_SUBSCRIPTION: "소득·자산 기준과 순위·가점이 핵심이다. 무주택 기간을 따진다.",
  UNIVERSITY_ADMISSION: "전형 유형과 최저학력기준이 핵심이다. 생기부·자소서를 낸다.",
  SCHOLARSHIP: "성적과 소득분위가 핵심이다. 추천서가 필요할 수 있다.",
  COMPETITION: "참가 자격과 제출물 규격이 핵심이다. 심사 기준을 본다.",
  EVENT_ENTRY: "무엇을 해야 응모가 되는지가 핵심이다. 기간을 놓치면 끝이다.",
  EXAM_CERTIFICATION: "응시 자격과 접수 기간이 핵심이다. 과목과 응시료를 확인한다.",
  PUBLIC_BENEFIT: "소득·연령 요건과 구비 서류가 핵심이다. 신청 창구를 확인한다.",
  MEMBERSHIP_PROGRAM: "기업 단계 요건과 혜택 조건이 핵심이다. 심사 절차를 본다.",
  PERMIT_FILING: "구비 서류와 처리 기간이 핵심이다. 수수료를 확인한다.",
  CONTRACT_TERMS: "의무 조항과 기한이 핵심이다. 위약 조건을 놓치면 손해가 크다.",
  OTHER: "일반적인 신청 절차로 다룬다.",
};

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}
