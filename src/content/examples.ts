/**
 * 입력 상자 아래에 까는 실제 예시.
 *
 * 예전에는 종류 이름만 적힌 알약 여섯 개였다. 「정부지원사업」을 눌러 봐야
 * 「청년창업사관학교 13기…」 같은 **지어낸 한 줄**이 들어갔고, 그래서 눌러도
 * 무슨 일이 벌어지는지 알 수 없었다. 여기 있는 것은 전부 실재하는 공고·프로그램이다.
 *
 * 링크가 있어도 **URL 만 넣지 않는다.** 사람이 쓰는 말투 그대로 부탁을 붙인다 —
 * 이 제품의 입구가 폼이 아니라 문장이라는 것이 예시에서부터 보여야 한다.
 * `intake` 가 문장 안의 링크를 뽑아내므로 동작은 URL 만 넣을 때와 같다.
 *
 * ⚠ 공고는 마감된다. 데모 전에 한 번씩 눌러 보고, 죽은 것은 갈아 끼운다.
 *   링크가 없는 항목은 제목만으로 조사 단계가 검색해 찾아간다.
 */
export type Example = {
  /** 버튼에 보이는 말 */
  label: string;
  /** 유형. 섞여 있는 「추천」 탭에서 앞에 뱃지로 붙는다 */
  kind: string;
  /** 누르면 입력창에 그대로 들어가는 글 */
  input: string;
  /**
   * 같이 붙는 공고문.
   *
   * 청약은 링크로 못 준다 — 청약홈은 로그인 뒤 뷰어로 열리고 PDF 주소가 밖으로
   * 나오지 않는다. 그래서 실제 입주자모집공고문을 `public/` 에 두고 누르는
   * 순간 첨부한다. 데모에서 가장 무거운 문서를 실제로 통과시키는 자리다.
   */
  file?: { url: string; name: string };
};

export type ExampleGroup = { id: string; label: string; items: Example[] };

const CREDIT_KIND = "크레딧";
const GOV_KIND = "정부지원";
const HOUSING_KIND = "청약";
const CONTEST_KIND = "공모전";

/** 링크 하나에 부탁 한 줄. 링크는 문장 앞에 둔다 — 잘려도 주소는 남는다 */
function withLink(url: string, ask: string): string {
  return `${url}\n${ask}`;
}

const CREDITS: Example[] = [
  {
    label: "일레븐랩스 스타트업 그랜트",
    kind: CREDIT_KIND,
    input: withLink(
      "https://elevenlabs.io/startup-grants",
      "여기 그랜트 우리가 받을 수 있는지 보고 신청서까지 준비해줘",
    ),
  },
  {
    label: "노션 for Startups",
    kind: CREDIT_KIND,
    input: withLink(
      "https://www.notion.com/startups",
      "이 크레딧 우리 회사가 자격 되는지 따져 보고 신청 준비해줘",
    ),
  },
  {
    label: "러버블 스타트업 프로그램",
    kind: CREDIT_KIND,
    input: withLink(
      "https://lovable.dev/partners/startup",
      "이거 어떻게 신청하는지 정리하고 낼 것들 준비해줘",
    ),
  },
  {
    label: "Claude for Startups",
    kind: CREDIT_KIND,
    input: withLink(
      "https://claude.com/programs/startups",
      "우리가 이 프로그램 조건에 맞는지 보고 지원서 써줘",
    ),
  },
  {
    label: "AWS Activate · 아마존 베드락 크레딧",
    kind: CREDIT_KIND,
    input: withLink(
      "https://aws.amazon.com/startups/credits",
      "베드락 크레딧 받으려면 뭘 내야 하는지 정리하고 신청 준비해줘",
    ),
  },
];

const GOVERNMENT: Example[] = [
  {
    label: "[경북] 포항시 2026년 AI라이브커머스 지원기업 추가 모집",
    kind: GOV_KIND,
    input:
      "[경북] 포항시 2026년 AI라이브커머스 지원기업 추가 모집 공고(온라인 판로 지원사업) — 우리가 자격 되는지 보고 신청까지 준비해줘",
  },
  {
    label: "[충남] 지역에너지 문제해결 프로젝트 지원사업 추가모집",
    kind: GOV_KIND,
    input:
      "[충남] 지역에너지 문제해결 프로젝트 지원사업 추가모집 공고 — 신청 자격이랑 낼 서류 정리해서 준비해줘",
  },
  {
    label: "[경북] 포항시 신산업플러스 일자리창출 우수기업 지원사업",
    kind: GOV_KIND,
    input:
      "[경북] 포항시 2026년 신산업플러스 일자리창출 우수기업 지원사업 참여기업 추가모집 공고 — 우리 되는지 확인하고 신청서 써줘",
  },
  {
    label: "[경기] 안산시 지역특화분야 유망 창업기업 지원사업",
    kind: GOV_KIND,
    input:
      "[경기] 안산시 2026년 지역특화분야 유망 창업기업 지원사업 참여기업 모집 공고 — 자격 요건 따져 보고 준비해줘",
  },
  {
    label: "[충북] AX기업혁신센터 공동연구센터 시제품제작지원",
    kind: GOV_KIND,
    input:
      "[충북] 2026년 2차 AX기업혁신센터 공동연구센터 시제품제작지원 사업 공고(지역혁신중심 대학지원체계(RISE)) — 이거 신청할 수 있는지 보고 서류 정리해줘",
  },
];

/** 입주자모집공고문 원본을 그대로 붙인다 */
const HOUSING: Example[] = [
  {
    label: "상동역 롯데캐슬 시그니처",
    kind: HOUSING_KIND,
    input: "이 입주자모집공고 내가 청약 자격 되는지 보고 신청 준비해줘",
    file: {
      url: "/examples/housing/sangdong-lotte-castle.pdf",
      name: "상동역 롯데캐슬 시그니처 입주자모집공고문.pdf",
    },
  },
  {
    label: "구리역 롯데캐슬 시그니처 (불법행위 재공급)",
    kind: HOUSING_KIND,
    input: "재공급 공고인데 내가 넣을 수 있는지 확인하고 필요한 서류 알려줘",
    file: {
      url: "/examples/housing/guri-lotte-castle.pdf",
      name: "구리역 롯데캐슬 시그니처 불법행위 재공급 입주자모집공고문.pdf",
    },
  },
  {
    label: "파주 운정신도시 호반써밋 이스트파크(5차) 임의공급",
    kind: HOUSING_KIND,
    input: "임의공급이라는데 조건이 뭔지 정리하고 신청 준비해줘",
    file: {
      url: "/examples/housing/paju-unjeong-hoban.pdf",
      name: "파주 운정신도시 A2블록 호반써밋 이스트파크(5차) 임의공급 입주자모집공고문.pdf",
    },
  },
  {
    label: "덕은 DMC에일린의뜰 센트럴 1차",
    kind: HOUSING_KIND,
    input: "이 공고 청약 자격이랑 일정 정리해서 신청까지 준비해줘",
    file: {
      url: "/examples/housing/deokeun-dmc-eileen.pdf",
      name: "덕은 DMC에일린의뜰 센트럴 1차 입주자모집공고문.pdf",
    },
  },
  {
    label: "왕십리역 어반홈스 B동",
    kind: HOUSING_KIND,
    input: "여기 넣어보려는데 내가 자격 되는지 따져 보고 준비해줘",
    file: {
      url: "/examples/housing/wangsimni-urbanhomes.pdf",
      name: "왕십리역 어반홈스 B동 입주자모집공고문.pdf",
    },
  },
];

const CONTESTS: Example[] = [
  {
    label: "오픈AI 게임 빌더스 서울",
    kind: CONTEST_KIND,
    input: withLink(
      "https://openaigame2026.com/",
      "이 해커톤 참가 요건이랑 제출물 정리하고 신청서 써줘",
    ),
  },
  {
    label: "(iM뱅크) 2026 AI Blockchain 경진대회",
    kind: CONTEST_KIND,
    input: withLink(
      "https://www.contestkorea.com/sub/view.php?Txt_gbn=1&Txt_bcode=030310001&str_no=202608130040",
      "이 대회 우리가 나갈 수 있는지 보고 접수 준비해줘",
    ),
  },
  {
    label: "제24회 임베디드SW경진대회",
    kind: CONTEST_KIND,
    input: withLink(
      "https://www.eswcontest.or.kr/",
      "자유공모 부문 참가 조건이랑 마감 정리하고 신청 준비해줘",
    ),
  },
  {
    label: "2026 AI·디지털 네이티브 토론대회",
    kind: CONTEST_KIND,
    input: "2026 AI·디지털 네이티브 토론대회 — 참가 자격이랑 제출물 정리해서 준비해줘",
  },
  {
    label: "모두의 AI 실험실 AI 서비스 경진대회",
    kind: CONTEST_KIND,
    input: withLink(
      "https://contest.aitestbed.kr/",
      "이 경진대회 접수 요건 확인하고 신청서 준비해줘",
    ),
  },
];

/**
 * 첫 탭은 종류를 섞는다.
 *
 * 「공고」를 좁게 잡으면 사용자가 정부지원사업만 떠올린다. 자격을 따지고 서류를
 * 내는 일은 전부 같은 구조다 — 청약도, 크레딧 신청도, 공모전도. 섞은 만큼
 * 유형 뱃지가 앞에 붙어야 무엇을 누르는지 알 수 있다.
 */
export const EXAMPLE_GROUPS: ExampleGroup[] = [
  {
    id: "picks",
    label: "추천",
    items: [CREDITS[3], GOVERNMENT[0], HOUSING[0], CONTESTS[0], CREDITS[0]],
  },
  { id: "credits", label: "스타트업 크레딧", items: CREDITS },
  { id: "government", label: "정부지원사업", items: GOVERNMENT },
  { id: "housing", label: "주택 청약", items: HOUSING },
  { id: "contests", label: "공모전·대회", items: CONTESTS },
];
