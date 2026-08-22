/**
 * 랜딩 문구 단일 소스.
 *
 * 컴포넌트에 문자열을 박지 않는다. 섹션 구조를 유지한 채 여기만 고치면
 * 랜딩 전체가 따라온다.
 *
 * ⚠ 수치는 전부 코드에 실재하는 값이거나 실측값이다. 지어낸 지표를 넣지 않는다 —
 * 심사위원 앞에서 검증되면 나머지 주장까지 같이 죽는다.
 */
export const site = {
  /** 제품명. */
  name: "Antelope",
  /** 팀명 — 제품명이 바뀌어도 유지된다. */
  team: "Samin Queue",
  tagline: "어플라이 컨시어지",
  description:
    "공고문 하나 던져 놓으면 자격이 되는지 따져 보고, 낼 서류를 정리하고, 신청 사이트에 들어가 지원서까지 씁니다. 한 번 답한 정보는 다음 공고에서 다시 묻지 않습니다.",
  repo: "https://github.com/Samin-Queue/antelope",
  /** 배포 원본(canonical). 구글 OAuth 동의 화면의 홈페이지 URL 과 같아야 한다. */
  url: "https://antelope.up.railway.app",

  cta: { label: "무료로 시작하기", href: "/app" },
  secondaryCta: { label: "동작 방식 보기", href: "#steps" },
  /**
   * 헤더 우측의 페이지 이동.
   *
   * `nav` 에 두면 안 된다 — 나머지는 전부 같은 문서 안의 앵커라 눌러도 화면이
   * 바뀌지 않는데, 이것만 다른 페이지로 떠난다.
   */
  engineCta: { label: "엔진 소개", href: "/engine" },

  /** 상단 공지 필 */
  announcement: {
    label: "JunctionX Korea 2026",
    text: "포항 · Upstage 트랙",
    href: "/app",
  },

  nav: [
    { label: "동작 방식", href: "#steps" },
    { label: "특징", href: "#features" },
    { label: "지식 베이스", href: "#memory" },
    { label: "기술", href: "#pipeline" },
  ],

  /**
   * 히어로.
   *
   * 헤드라인은 `lead + [회전 문구] + tail` 한 문장이다. 회전 문구는 목적격
   * 조사를 붙여 렌더하므로 조사 없이 명사구로만 적는다 — 을/를 은 받침에서
   * 계산된다(`hero-rotator.tsx`).
   */
  hero: {
    lead: "Antelope로",
    rotating: [
      "대학 입시원서 지원",
      "장학금 신청",
      "소셜미디어 이벤트 응모",
      "자격증 시험 접수",
      "공모전·대회 참가",
      "보험금 청구",
      "채용 공고 지원",
      "정부지원사업 신청",
      "청약 신청",
    ],
    tail: "버튼 한 번으로 끝내세요",
    sub: "공고문 파일이든 캡쳐 한 장이든 신청 페이지 링크든, 있는 그대로 넣기만 하면 됩니다. 자격이 되는지 따져 보고, 필요한 서류를 정리하고, 신청 사이트에 들어가 지원서까지 대신 씁니다.",
    note: "여기 적은 내용은 아직 아무 데도 보내지 않습니다. 마지막 제출 버튼은 당신이 누릅니다.",
  },

  /**
   * 히어로 아래 단계 밴드.
   *
   * 내부 지표(분류 13종·임계값 0.50)는 심사자에게는 근거지만 사용자에게는
   * 아무 의미가 없다. 사용자가 실제로 겪는 순서로 바꿔 적는다.
   */
  steps: {
    eyebrow: "이렇게 흘러갑니다",
    headline: "당신이 할 일은 목표를 넣는 것뿐입니다",
    sub: "목표를 넣고 나면 손을 떼도 됩니다. 나머지 네 단계는 Antelope 가 알아서 이어 갑니다.",
    items: [
      {
        title: "목표 입력하기",
        body: "공고문 파일을 올리든, 신청 페이지 주소를 붙여넣든, 「이거 나도 되나?」 하고 물어보든 상관없습니다. 정리해서 넣지 않아도 됩니다.",
        /** 사람에서 에이전트로 넘어가는 지점. 첫 단계에만 있다 */
        handoff: "그리고 끝입니다. 나머지는 Antelope 가 진행합니다.",
      },
      {
        title: "계획하기",
        body: "공고를 처음부터 끝까지 읽고 자격 요건과 낼 서류, 마감일과 평가 배점을 뽑아냅니다. 그리고 당신이 이 공고에 해당되는지부터 따져 봅니다. 판단마다 공고의 어느 문장을 보고 그렇게 결론 냈는지 함께 보여 줍니다.",
        handoff: null,
      },
      {
        title: "수집하기",
        body: "이 공고를 넣는 데 실제로 필요한 것만 물어봅니다. 전에 답한 적 있는 항목은 지식 베이스에서 꺼내 미리 채워 두니, 당신은 남은 빈칸만 메우면 됩니다.",
        handoff: null,
      },
      {
        title: "수행하기",
        body: "신청 사이트를 직접 열어 로그인하고, 폼을 한 칸씩 채우고, 배점에 맞춰 지원서를 씁니다. 채워 나가는 과정을 화면으로 지켜볼 수 있고, 마지막 제출 버튼 앞에서 멈춰 당신을 부릅니다.",
        handoff: null,
      },
      {
        title: "축적하기",
        body: "이번에 답한 내용과 결과가 그대로 남습니다. 다음 공고는 이미 아는 상태에서 시작하니, 두 번째부터는 물어볼 것이 눈에 띄게 줄어듭니다.",
        handoff: null,
      },
    ],
  },

  /** 기능 그리드 */
  features: {
    eyebrow: "무엇이 다른가",
    headline: "읽는 것에서 끝나지 않습니다",
    items: [
      {
        title: "파일 한 장이면 시작합니다",
        body: "캡쳐 이미지, HWP 공고문, 신청 페이지 링크, 「이거 나 되나?」 하는 말 한 줄. 어느 쪽으로 넣어도 자격 요건과 제출 서류, 배점과 마감이 같은 모양으로 정리되어 나옵니다. 미리 요약하거나 옮겨 적을 필요가 없습니다.",
        bullet: "무엇을 넣었는지는 그다음 단계가 알 필요 없다",
      },
      {
        title: "분석부터 제출까지 한 번에 처리합니다",
        body: "공고를 읽어 주는 것으로 끝내지 않습니다. 필요한 정보를 모으고, 신청 사이트에 로그인하고, 지원서를 쓰는 데까지 끊기지 않고 이어집니다. 마지막 제출 버튼 앞에서 한 번 부릅니다.",
        bullet: "브라우저를 직접 열어 폼을 채운다",
      },
      {
        title: "나를 가장 잘 아는 에이전트가 씁니다",
        body: "지식 베이스에 쌓인 사실과 강점을 근거로, 평가 배점에 맞춰 무엇을 어떻게 쓸지 짭니다. 빈 화면을 열어 놓고 첫 문장부터 고민할 일이 없습니다.",
        bullet: "배점 항목마다 무엇을 쓸지 나온다",
      },
      {
        title: "모든 판단에 원문 근거를 답니다",
        body: "요건마다 공고의 어느 문장을 보고 그렇게 판정했는지 그대로 붙입니다. 원문에서 확인되지 않은 것은 아는 척하지 않고 「직접 확인해야 합니다」로 따로 모아 보여 줍니다.",
        bullet: "확인 안 된 항목은 감추지 않고 드러낸다",
      },
    ],
  },

  /** 지식 베이스 — 이 제품의 해자 */
  memory: {
    eyebrow: "제품의 해자",
    headline: "매번 같은 정보를 다시 입력하지 않습니다",
    sub: "한 번 답한 정보는 계정에 그대로 쌓입니다. 다음 공고가 같은 것을 다른 말로 물어도 알아서 찾아냅니다. 항목 이름만 따로 임베딩하고 값은 섞지 않기 때문입니다. 「1999-04-12」 같은 값이 끼면 의미가 흐려집니다.",
    tableHead: { query: "다음 공고가 묻는 말", match: "저장해 둔 항목", score: "유사도" },
    rows: [
      { query: "상시근로자 수", match: "현재 직원 수", score: "0.578", hit: true },
      { query: "생년월일", match: "생년월일", score: "0.753", hit: true },
      { query: "상시근로자 수", match: "업종명", score: "0.409", hit: false },
    ],
    note: "찾았다고 볼 기준은 0.50 입니다. 정답 중 가장 낮은 0.578 과 오답 중 가장 높은 0.435 사이에서 골랐습니다. 더 올리면 있는 값도 못 찾고, 내리면 엉뚱한 값을 자동으로 채워 넣습니다.",
    aside: {
      title: "지식은 말로 고칩니다",
      body: "표를 직접 손보지 않습니다. 무엇을 어떻게 바꿀지 말하면 큐레이터 에이전트가 판단해 반영합니다. 「그거 좀 바꿔줘」처럼 애매하게 말하면 추측하지 않고 무엇을 말하는지 되묻습니다.",
    },
    graph: {
      title: "이 선은 꾸며낸 것이 아닙니다",
      body: "지식 그래프에서 두 항목을 잇는 선의 굵기는 저장된 1024차원 벡터의 실제 코사인 유사도입니다. 아는 것이 늘수록 그물이 촘촘해지고, 서로 이어진 정보끼리 함께 꺼내집니다.",
    },
  },

  /** 비교 */
  comparison: {
    eyebrow: "왜 미루게 되는가",
    headline: "지원을 포기하게 만드는 건 자격이 아니라 절차입니다",
    sub: "요건은 맞는데 준비할 게 많아 미루다가 마감을 넘깁니다. 왼쪽은 지금 손으로 하는 일이고, 오른쪽은 Antelope 를 켰을 때 남는 일입니다.",
    columns: { before: "지금", after: "Antelope 를 켜면" },
    rows: [
      {
        before: "공고문 PDF 를 열어 요건을 하나씩 손으로 옮겨 적는다",
        after: "자격 요건과 낼 서류, 배점과 마감이 정리된 채로 나온다",
      },
      {
        before: "내가 해당되는지 몰라 담당자에게 전화를 건다",
        after: "요건마다 되는지 안 되는지, 모르면 왜 모르는지 나온다",
      },
      {
        before: "제출 서류를 어디서 떼야 하는지 검색으로 찾는다",
        after: "서류마다 어디서 발급받고 얼마나 걸리는지 붙는다",
      },
      {
        before: "지난번 신청서를 뒤져 같은 정보를 다시 옮긴다",
        after: "전에 답한 값은 이미 채워진 채로 시작한다",
      },
      {
        before: "신청 사이트에 로그인해 같은 정보를 또 입력한다",
        after: "에이전트가 로그인하고 폼까지 채운 뒤 제출 직전에 멈춘다",
      },
    ],
  },

  /** 파이프라인 — Upstage Studio 노드 구성 */
  pipeline: {
    headline: "문서 처리는 Upstage Studio 가 맡습니다",
    sub: "워크플로를 화면에서 클릭해 만들지 않고 코드로 정의해 API 로 올립니다. 그래서 무엇을 어떻게 바꿨는지 기록에 남고, 언제든 같은 구성을 다시 만들 수 있습니다.",
    items: [
      {
        name: "document-parse",
        desc: "HWP, PDF, 사진에서 표와 서식을 지킨 채로 글을 뽑아냅니다",
      },
      {
        name: "document-classify",
        desc: "13종 중 어떤 문서인지 가르고, 한 파일에 여러 건이 섞여 있으면 쪼갭니다",
      },
      {
        name: "extract-contract",
        desc: "계약과 약관은 의무 조항과 기한을 놓치지 않도록 따로 읽습니다",
      },
      {
        name: "extract-housing",
        desc: "청약은 소득과 자산 기준, 순위와 가점 계산 방식을 그대로 옮깁니다",
      },
      {
        name: "extract-job",
        desc: "채용 공고는 자격과 우대사항, 전형 절차를 나눠 담습니다",
      },
      {
        name: "extract-general",
        desc: "나머지는 공통 경로를 타면서 요건과 서류를 빠짐없이 담습니다",
      },
      {
        name: "instruct",
        desc: "원문에서 확인되지 않은 것만 골라 직접 확인할 목록으로 남깁니다",
      },
      {
        name: "citations",
        desc: "뽑아낸 값이 원문 어디에 있었는지 좌표로 함께 돌려줍니다",
      },
    ],
    note: "분류 결과에 따라 갈라지기 때문에, 문서가 어떤 종류든 요청마다 에이전트를 새로 만들 필요가 없습니다.",
  },

  /**
   * 앱 이름·목적·스코프 용도.
   *
   * ⚠ 화면에서 「서비스 소개」 섹션을 걷어낸 뒤로 이 값을 쓰는 곳은 랜딩의
   * JSON-LD 뿐이다. 심사는 **보이는 본문 텍스트**를 보므로 이대로는 브랜딩
   * 심사를 통과할 수 없다 — Publish 할 때 섹션을 되살린다.
   *
   * 심사가 세 가지를 본다. 앱 이름이 동의 화면과 **글자 그대로** 같은지,
   * 앱이 무엇을 하는지, 요청한 구글 권한을 어디에 쓰는지.
   *
   * ⚠ 헤더·푸터 로고는 SVG 라 심사자가 이름을 텍스트로 읽지 못한다. 히어로의
   *   「Antelope로」도 조사가 붙어 정확히 일치하지 않는다. 그래서 여기서 이름을
   *   맨 텍스트로 한 번 더 적는다 — 이 값을 고치려면 Google Cloud Console 의
   *   앱 이름도 같이 고쳐야 한다.
   * ⚠ 심사자는 한국어를 읽지 않는다. 영문을 나란히 둔다.
   */
  about: {
    eyebrow: "서비스 소개 · About",
    /** OAuth 동의 화면의 앱 이름과 글자 그대로 같다. 조사를 붙이지 않는다 */
    name: "Antelope",
    purpose:
      "Antelope 는 신청을 대신 해 주는 어플라이 컨시어지입니다. 공고문 PDF·HWP·캡쳐 이미지나 신청 페이지 링크를 넣으면 공고를 끝까지 읽어 자격 요건과 제출 서류, 마감일과 평가 배점을 뽑아냅니다. 그다음 이용자가 그 공고에 해당되는지 판정하고, 신청 사이트를 직접 열어 지원서를 채웁니다. 최종 제출 버튼 앞에서는 반드시 멈춰 이용자를 부릅니다. 한 번 답한 정보는 계정에 남아 다음 공고에서 다시 묻지 않습니다.",
    purposeEn:
      "Antelope is an application concierge. Give it a public notice — a PDF, an HWP file, a screenshot, or just a link — and it reads the notice end to end, extracts the eligibility requirements, required documents, deadline, and scoring criteria, then judges whether you qualify. It opens the agency's application website and fills in the form for you, always stopping before the final submit button so the last decision is yours. Anything you answer once is saved to your account and reused for the next application, so you are never asked for it twice.",
    scopes: {
      headline: "구글 계정 권한을 어디에 쓰나요 · How we use Google account data",
      sub: "로그인에는 이메일·이름·프로필 사진만 씁니다. 아래 두 권한은 「설정 · 연동」 화면에서 이용자가 직접 눌러 동의한 경우에만 요청하고, 언제든 해제할 수 있습니다.",
      subEn:
        "Signing in uses only your email, name, and profile picture. The two permissions below are requested only when you explicitly connect them on the Settings page, and you can disconnect them at any time.",
      items: [
        {
          scope: "auth/calendar",
          title: "구글 캘린더",
          body: "공고 마감일 주변에 이미 잡혀 있는 일정을 읽어 충돌을 알려 주고, 이용자가 요청하면 마감일을 일정으로 등록합니다.",
          bodyEn:
            "Reads events around an application deadline to warn you about conflicts, and adds the deadline to your calendar when you ask.",
        },
        {
          scope: "auth/gmail.modify",
          title: "Gmail",
          body: "접수 확인 메일을 찾아 신청 진행 상태를 갱신하고, 이용자가 요청한 메일을 대신 발송합니다.",
          bodyEn:
            "Finds confirmation emails from the agency to update the status of an application you submitted, and sends email on your behalf when you ask.",
        },
      ],
      note: "구글에서 받은 데이터는 위 기능을 제공하는 목적으로만 씁니다. 광고에 쓰거나 제3자에게 팔지 않으며, Google API Services User Data Policy 의 Limited Use 요건을 준수합니다.",
      noteEn:
        "Antelope's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
    },
    links: [
      { label: "개인정보처리방침 · Privacy Policy", href: "/privacy" },
      { label: "이용약관 · Terms of Service", href: "/terms" },
    ],
  },

  /** 최종 CTA */
  finalCta: {
    headline: "무엇을 신청하려고 하세요?",
    sub: "공고문을 끌어다 놓거나, 링크를 붙여넣거나, 그냥 말로 설명하세요. 정리해서 넣지 않아도 됩니다.",
    checklist: [
      "캡쳐 이미지도, HWP 공고문도, 링크도, 말 한 줄도 됩니다",
      "자격이 되는지 요건마다 원문 근거를 붙여 알려 줍니다",
      "낼 서류를 어디서 발급받고 얼마나 걸리는지 정리합니다",
      "평가 배점에 맞춰 무엇을 쓸지 짜 줍니다",
      "신청 사이트에 들어가 폼을 채우고 제출 직전에 멈춥니다",
      "한 번 답한 정보는 다음 공고에서 다시 묻지 않습니다",
    ],
  },

  /** 푸터 4열 */
  footer: [
    {
      title: "제품",
      links: ["워크스페이스", "지식 베이스", "지난 목표", "플레이그라운드"],
    },
    {
      title: "활용",
      links: ["정부지원사업", "임대·분양 청약", "대학 수시", "공모전·이벤트"],
    },
    {
      title: "기술",
      links: ["Upstage Document AI", "Solar Pro", "pgvector", "브라우저 에이전트"],
    },
    { title: "팀", links: ["Samin Queue", "JunctionX Korea 2026", "포항", "GitHub"] },
  ],
} as const;
