/**
 * 랜딩 문구 단일 소스.
 * 8/21 20:00 트랙 발표 후 이 파일만 고치면 랜딩 전체가 바뀐다.
 */
export const site = {
  name: "Samin Queue",
  tagline: "트랙 미정",
  description:
    "JunctionX Korea 2026 · 포항 · 8월 21–23일. 트랙 발표 후 제품 설명으로 교체합니다.",
  team: "Samin Queue",
  repo: "https://github.com/Samin-Queue/samin-queue",
  cta: { label: "데모 열기", href: "/playground" },

  /** 히어로 */
  hero: {
    eyebrow: "JunctionX Korea 2026",
    headline: "여기에 한 문장짜리 제품 정의가 들어간다",
    sub: "누구의 어떤 문제를, 어떻게 다르게 푸는지. 심사위원이 3초 안에 이해할 수 있는 길이로.",
  },

  /** 3-슬롯 가치 제안 — 문제 / 해법 / 차별점 */
  pillars: [
    {
      title: "문제",
      body: "누가, 얼마나 자주, 얼마나 크게 겪는 문제인지. 숫자로.",
    },
    {
      title: "해법",
      body: "제품이 실제로 하는 일 한 문장. 기능 나열이 아니라 결과로.",
    },
    {
      title: "차별점",
      body: "왜 기존 방식·경쟁 팀이 못 하는지. 기술적 근거 한 줄.",
    },
  ],

  /** 데모에서 보여줄 흐름 */
  steps: [
    { step: "01", title: "입력", body: "사용자가 무엇을 넣는가" },
    { step: "02", title: "처리", body: "어떤 AI 파이프라인을 통과하는가" },
    { step: "03", title: "결과", body: "무엇을 얻고 무엇이 달라지는가" },
  ],
} as const;
