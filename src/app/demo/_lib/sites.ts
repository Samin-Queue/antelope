/**
 * 데모용 가짜 공고 사이트 레지스트리.
 *
 * 실제 사이트에 자동 신청을 시도할 수 없으니, 에이전트가 공고를 읽고 신청까지
 * 수행하는 흐름을 검증할 대상이 필요하다. 여기 있는 기관·기업은 전부 가상이다.
 *
 * 세대가 둘이다.
 *
 *   v1  공고문 한 장 + 신청 폼 한 장. 신청 방식의 다양성을 본다.
 *   v4  기관 포털을 통째로 흉내낸다 — 공지 목록, 공고 상세, FAQ, 첨부 문서.
 *       **트리거가 공고문 PDF 나 홍보 이미지 한 장**이고, 거기엔 신청 페이지
 *       주소만 있다. 마감일·모집인원·제출서류 같은 실제 값은 사이트를 타고
 *       들어가 첨부 HWP·XLSX 를 열어야 나온다. 그 탐색이 v4 가 검증하는 것이다.
 *
 * 각 사이트는 최소 두 페이지를 갖는다:
 *   /demo/<slug>        공고문 또는 기관 포털 홈
 *   /demo/<slug>/apply  신청 폼 — 클래스마다 신청 방식이 다르다
 *
 * 신청 방식이 다양한 것이 이 데모의 목적이다. 단순 텍스트 입력만으로는
 * 파일 업로드·동적 행 추가·캐스케이딩 선택 같은 실제 마찰을 재현할 수 없다.
 */

export type DemoSite = {
  slug: string;
  /** 세대. 인덱스가 이걸로 묶어 보여준다 */
  gen: "v1" | "v4";
  /** 클래스 표의 클래스명 */
  klass: string;
  /** 가상 기관/기업명 */
  org: string;
  orgEn: string;
  title: string;
  /** 이 사이트가 검증하려는 신청 방식 */
  mechanism: string;
  deadline: string;
  /** 사이트마다 다른 브랜드색 — 한 팀이 만든 것처럼 보이면 안 된다 */
  accent: string;
  accentSoft: string;
  accentText: string;
  /**
   * 공고문 PDF 가 찍을 페이지. v4 는 루트가 공지 목록이라 상세 경로를 따로 준다.
   * 비우면 `/demo/<slug>` 를 찍는다.
   */
  noticePath?: string;
  /** 홍보 이미지(포스터) 페이지가 있는가 — `/demo/<slug>/poster` */
  poster?: boolean;
};

export const demoSites: DemoSite[] = [
  {
    slug: "startup-fund",
    gen: "v1",
    klass: "정부지원사업",
    org: "누리창업진흥원",
    orgEn: "NURI Startup Agency",
    title: "2026년 초기창업패키지 창업기업 모집공고",
    mechanism: "4단계 위저드 · 지정양식 다운로드 후 재업로드 · 자격 자가진단",
    deadline: "2026-09-12 18:00",
    accent: "bg-[#1b3a6b]",
    accentSoft: "bg-[#eef3fa]",
    accentText: "text-[#1b3a6b]",
  },
  {
    slug: "hiring",
    gen: "v1",
    klass: "채용 공고",
    org: "주식회사 다온소프트",
    orgEn: "DAON SOFT",
    title: "2026 하반기 백엔드 엔지니어 채용",
    mechanism: "경력·학력 행 동적 추가 · 이력서/포트폴리오 이중 업로드 · 글자수 제한",
    deadline: "2026-09-05 23:59",
    accent: "bg-[#0f6f5c]",
    accentSoft: "bg-[#eaf5f2]",
    accentText: "text-[#0f6f5c]",
  },
  {
    slug: "housing",
    gen: "v1",
    klass: "임대 분양 청약",
    org: "한빛주택공사",
    orgEn: "HANBIT Housing",
    title: "포항 장량 행복주택 예비입주자 모집",
    mechanism: "실시간 가점 계산 · 세대원 표 입력 · 조건부 질문 분기",
    deadline: "2026-09-19 17:00",
    accent: "bg-[#155e88]",
    accentSoft: "bg-[#eaf4f9]",
    accentText: "text-[#155e88]",
  },
  {
    slug: "cert-exam",
    gen: "v1",
    klass: "자격증 시험",
    org: "한국정보기술자격검정원",
    orgEn: "KITQ",
    title: "제38회 정보처리 실무능력 검정 접수",
    mechanism: "지역→고사장→회차 캐스케이딩 · 증명사진 미리보기 · 응시료 결제 단계",
    deadline: "2026-08-29 18:00",
    accent: "bg-[#3b3ba8]",
    accentSoft: "bg-[#eeeefb]",
    accentText: "text-[#3b3ba8]",
  },
  {
    slug: "hackathon",
    gen: "v1",
    klass: "공모전 대회",
    org: "오픈이노베이션 챌린지",
    orgEn: "Open Innovation Challenge",
    title: "제7회 공공데이터 활용 아이디어 공모전",
    mechanism: "드래그앤드롭 업로드 · 팀원 초대 · 제출물 규격 클라이언트 검증",
    deadline: "2026-09-26 12:00",
    accent: "bg-[#6d28d9]",
    accentSoft: "bg-[#f3edfd]",
    accentText: "text-[#6d28d9]",
  },
  {
    slug: "permit",
    gen: "v1",
    klass: "인허가 신고",
    org: "온빛시청 위생민원과",
    orgEn: "ONBIT City Hall",
    title: "일반음식점 영업신고 온라인 접수",
    mechanism:
      "지정서식 HWP 다운로드 후 HWP 로만 제출 · 파일명 규칙 · 전자서명 · 수수료 납부",
    deadline: "상시 접수 (처리기간 3일)",
    accent: "bg-[#8a4b1f]",
    accentSoft: "bg-[#faf1e9]",
    accentText: "text-[#8a4b1f]",
  },
  {
    slug: "scholarship",
    gen: "v1",
    klass: "장학금",
    org: "미래희망장학재단",
    orgEn: "MIRAE HOPE Foundation",
    title: "2026학년도 2학기 성적우수 장학생 선발",
    mechanism: "회원가입 · 이메일 인증 · 로그인 후에만 신청서가 열림",
    deadline: "2026-09-30 18:00",
    accent: "bg-[#a3123f]",
    accentSoft: "bg-[#fcecf1]",
    accentText: "text-[#a3123f]",
  },

  /* ------------------------------------------------------------------ */
  /* v4 — 포털을 통째로 흉내낸다                                         */
  /* ------------------------------------------------------------------ */

  {
    slug: "youth-housing",
    gen: "v4",
    klass: "공공지원 민간임대",
    org: "새길주거공사",
    orgEn: "SAEGIL Housing",
    title: "역세권 청년안심주택 「한빛스테이 장량」 공공지원민간임대 입주자 모집",
    mechanism:
      "공지 목록에서 비슷한 공고 3건 중 고르기 · 청약 일정이 첨부 XLSX 에만 있음 · 5단계 위저드",
    deadline: "2026-09-18 17:00",
    accent: "bg-[#0b4f9e]",
    accentSoft: "bg-[#eaf1fa]",
    accentText: "text-[#0b4f9e]",
    noticePath: "/demo/youth-housing/notice/2026-0087",
    poster: true,
  },
  {
    slug: "junction-apply",
    gen: "v4",
    klass: "해커톤 참가 지원",
    org: "JUNCTION KOREA 2026",
    orgEn: "Organizing Committee",
    title: "JUNCTION KOREA 2026 참가자 모집 · Participant Application",
    mechanism:
      "영문 랜딩 · 트랙별 분기 질문 · 팀원 동적 행 · 에세이 글자수 · AoE 마감 함정",
    deadline: "2026-09-30 23:59 (AoE)",
    accent: "bg-[#0b0b12]",
    accentSoft: "bg-[#efecff]",
    accentText: "text-[#4c1fd7]",
    poster: true,
  },
  {
    slug: "easy-univ",
    gen: "v4",
    klass: "대학 수시모집",
    org: "이지대학교 입학처",
    orgEn: "EASY UNIVERSITY",
    title: "2027학년도 수시모집 원서접수 안내",
    mechanism:
      "입학처 공지 목록 · 모집인원이 첨부 XLSX 에만 있음 · 대행사 로그인 · 전형료 결제",
    deadline: "2026-09-11 18:00",
    accent: "bg-[#00563f]",
    accentSoft: "bg-[#e9f3ef]",
    accentText: "text-[#00563f]",
    noticePath: "/demo/easy-univ/notice/2027-susi",
    poster: true,
  },
];

export function getSite(slug: string): DemoSite {
  const site = demoSites.find((s) => s.slug === slug);
  if (!site) throw new Error(`unknown demo site: ${slug}`);
  return site;
}

/** 공고문 PDF 가 찍을 경로 */
export function noticePath(site: DemoSite): string {
  return site.noticePath ?? `/demo/${site.slug}`;
}
