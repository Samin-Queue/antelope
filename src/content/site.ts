/**
 * 랜딩 문구 단일 소스.
 *
 * ⚠ 아래 문구는 전부 **더미**다. 트랙이 정해지면(8/21 20:00) 이 파일만 고친다.
 * 구조는 유지하고 텍스트만 갈아끼우면 랜딩 전체가 따라온다.
 */
export const site = {
  /** 제품명. */
  name: "Antelope",
  /** 팀명 — 제품명이 바뀌어도 유지된다. */
  team: "Samin Queue",
  tagline: "더미 태그라인",
  description:
    "JunctionX Korea 2026 · 포항 · 8월 21–23일. 트랙 발표 후 제품 설명으로 교체합니다.",
  repo: "https://github.com/Samin-Queue/antelope",

  cta: { label: "무료로 시작하기", href: "/sign-in" },
  secondaryCta: { label: "데모 보기", href: "/app/notices" },

  /** 상단 공지 필 */
  announcement: {
    label: "JunctionX Korea 2026",
    text: "포항 · 8월 21–23일 · 트랙 발표 D-0",
    href: "/documents",
  },

  nav: [
    { label: "제품", href: "#features" },
    { label: "활용 사례", href: "#usecases" },
    { label: "문서", href: "#integrations" },
    { label: "가격", href: "#pricing" },
  ],

  hero: {
    headline: "여기에 한 문장짜리 제품 정의가 들어간다 — 더미 헤드라인",
    sub: "누구의 어떤 문제를 어떻게 다르게 푸는지 두 줄로. 심사위원이 3초 안에 이해할 수 있는 길이로 쓴다.",
    note: "신용카드 없이 시작 · 30초면 첫 결과",
  },

  /** 히어로 아래 지표 밴드 */
  stats: {
    eyebrow: "숫자로 보는 더미",
    headline: "하나의 파이프라인으로 처리하고, 결과는 즉시 확인한다",
    sub: "아래 수치는 전부 더미다. 트랙 확정 후 실제 측정값으로 교체한다.",
    items: [
      {
        value: "4.5x",
        label: "기존 방식 대비 처리 속도",
        detail: "동일 문서 기준 왕복 시간 비교",
      },
      {
        value: "99.2%",
        label: "필드 추출 정확도",
        detail: "한국어 표·서식 문서 샘플 기준",
      },
      {
        value: "1.8s",
        label: "첫 결과까지 걸린 시간",
        detail: "업로드부터 구조화 완료까지",
      },
      { value: "24/7", label: "중단 없는 처리", detail: "대기열 없이 즉시 실행" },
    ],
  },

  /** 소셜 프루프 */
  proof: {
    headline: "이미 여러 팀이 더미로 쓰고 있습니다",
    sub: "아래 이름은 전부 자리표시자다.",
    logos: ["ACME", "NORTHWIND", "UMBRELLA", "INITECH", "GLOBEX", "SOYLENT"],
  },

  /** 기능 그리드 */
  features: {
    eyebrow: "왜 이걸 쓰는가",
    headline: "필요한 것만, 처음부터 끝까지",
    items: [
      {
        title: "더미 기능 하나",
        body: "이 카드에는 제품이 실제로 하는 일을 한 문장으로 적는다. 기능 나열이 아니라 사용자가 얻는 결과로 쓴다.",
        bullet: "입력 → 처리 → 결과가 한 화면에서 끝난다",
      },
      {
        title: "더미 기능 둘",
        body: "왜 기존 방식이나 경쟁 제품이 이걸 못 하는지 기술적 근거를 한 줄 덧붙인다.",
        bullet: "설정 없이 바로 동작",
      },
      {
        title: "더미 기능 셋",
        body: "숫자를 넣을 수 있으면 넣는다. 형용사보다 수치가 설득력이 높다.",
        bullet: "평균 1.8초",
      },
      {
        title: "더미 기능 넷",
        body: "마지막 카드에는 확장성이나 팀 협업 관점을 담는다.",
        bullet: "팀 단위로 공유",
      },
    ],
  },

  /** 인용 */
  testimonial: {
    quote:
      "여기에는 실제 사용자의 한 문단짜리 인용이 들어간다. 문제가 무엇이었고, 도입 후 무엇이 달라졌는지 구체적으로 말하는 문장이 좋다. 지금은 전부 더미다.",
    author: "홍길동",
    role: "더미 컴퍼니 · 프로덕트 리드",
  },

  /** 비교 */
  comparison: {
    eyebrow: "무엇이 다른가",
    headline: "복잡한 설정과 싸우지 않는다",
    rows: [
      {
        before: "여러 도구를 붙여 파이프라인을 손으로 만든다",
        after: "한 곳에서 업로드하면 끝난다",
      },
      {
        before: "결과 포맷이 도구마다 달라 후처리가 필요하다",
        after: "구조화된 결과를 그대로 쓴다",
      },
      {
        before: "실패하면 어디서 깨졌는지 찾기 어렵다",
        after: "단계별로 무엇이 나왔는지 보인다",
      },
    ],
  },

  /** 통합 */
  integrations: {
    headline: "기존 워크플로에 그대로 들어간다",
    sub: "별도 도구를 배우지 않아도 된다. 아래 항목은 전부 더미다.",
    items: [
      "REST API",
      "웹훅",
      "CSV 내보내기",
      "Slack",
      "Google Drive",
      "Notion",
      "Zapier",
      "SDK",
    ],
  },

  /** 최종 CTA */
  finalCta: {
    headline: "지금 바로 시작하세요",
    sub: "더미 문구입니다. 신용카드 없이 시작할 수 있고, 첫 결과까지 30초면 충분합니다.",
    checklist: [
      "설정 없이 즉시 사용",
      "한국어 문서에 최적화",
      "구조화된 결과를 API 로 바로 사용",
      "팀 단위 공유와 권한 관리",
      "사용한 만큼만 과금",
      "언제든 데이터 내보내기",
    ],
  },

  /** 푸터 4열 */
  footer: [
    { title: "제품", links: ["개요", "문서 파이프라인", "플레이그라운드", "API"] },
    {
      title: "활용",
      links: ["더미 사례 A", "더미 사례 B", "더미 사례 C", "더미 사례 D"],
    },
    { title: "리소스", links: ["문서", "변경 로그", "상태", "지원"] },
    { title: "회사", links: ["소개", "블로그", "채용", "문의"] },
  ],
} as const;
