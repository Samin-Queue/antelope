/**
 * `/engine` 문구·데이터 단일 소스.
 *
 * 대상 독자가 다르다. 랜딩(`site.ts`)은 신청을 해야 하는 사람에게 말하고,
 * 여기는 **엔진을 검증하려는 사람**에게 말한다 — Upstage 트랙 심사가
 * 「Studio 가 문서 처리의 중심인가」를 확인할 수 있어야 한다.
 *
 * ⚠ 여기 적힌 수치·ID·스텝 이름은 전부 코드에 실재하는 값이거나 실측값이다.
 *   지어낸 지표를 넣지 않는다. 코드를 고치면 여기도 같이 고친다 — 특히
 *   `studio-workflow.ts` · `lab/validation/_lib/workflow.ts` ·
 *   `lab/analysis/_lib/workflow.ts` 의 스텝 이름과 `lanes.ts` 의 상한.
 */

export const engine = {
  eyebrow: "Engine · 내부 구조",
  headline: "문서는 Studio 가 읽고, 나머지는 Solar 가 합니다",
  sub: "있던 파이프라인 사이에 Upstage Studio 를 한 번 끼워 넣은 것이 아닙니다. 문서를 구조로 바꾸는 일은 Studio 가, 무엇을 찾고 무엇을 할지 정하는 일은 Solar 가 맡고, 둘이 서로의 출력을 받아 네 번 주고받습니다. 사용자가 파일을 올리지 않아도 Solar 가 웹에서 공고문 첨부를 찾아오고, 그마저 없으면 읽은 내용을 파일로 만들어 Studio 에 넘깁니다.",
  note: "이 페이지의 스텝 이름·임계값·동시성 상한은 저장소의 값과 같습니다. 파일 경로를 함께 적어 대조할 수 있게 했습니다.",

  /** 상단 지표. 전부 셀 수 있는 것만 둔다 */
  metrics: [
    {
      value: "3",
      label: "Upstage Studio 에이전트",
      sub: "코드로 정의해 API 로 올린 Config",
    },
    {
      value: "20",
      label: "Studio 워크플로 스텝",
      sub: "parse · classify · extract · instruct",
    },
    {
      value: "4",
      label: "Studio ↔ Solar 인계",
      sub: "한 건을 준비하며 서로에게 결과를 넘기는 횟수",
    },
    { value: "8", label: "준비 파이프라인 단계", sub: "intake → documents, SSE 로 중계" },
    { value: "11", label: "브라우저 도구", sub: "직렬화된 도구 루프" },
    { value: "47", label: "골든셋 케이스", sub: "순수 함수 · 1초 이내" },
  ],

  /**
   * 상단 탭. `id` 는 각 `<Section>` 의 것과 **글자 그대로** 같아야 한다 —
   * 다르면 눌러도 아무 일이 안 일어나고, 그 사실이 조용히 지나간다.
   */
  tabs: [
    { id: "duo", label: "분업" },
    { id: "handoff", label: "왕복" },
    { id: "flow", label: "파이프라인" },
    { id: "studio", label: "Studio" },
    { id: "gateway", label: "Solar" },
    { id: "runtime", label: "자원" },
    { id: "browser", label: "브라우저" },
    { id: "human", label: "사람" },
    { id: "relay", label: "슬랙" },
    { id: "memory", label: "지식베이스" },
    { id: "artifacts", label: "산출물" },
    { id: "fallback", label: "폴백" },
  ],

  // ── 0. 두 엔진 ──────────────────────────────────────────────────────
  duo: {
    eyebrow: "0 · 분업",
    headline: "잘하는 일이 다른 두 엔진",
    sub: "같은 일을 두 번 시키지 않습니다. 문서에서 값을 꺼내는 일에 범용 LLM 을 쓰면 표가 뭉개지고 좌표가 없습니다. 반대로 「이 링크 중 무엇이 공고 첨부인가」를 문서 파이프라인에 물을 수는 없습니다.",
    columns: [
      {
        name: "Upstage Studio",
        role: "문서 · 정규화 · 데이터 가공",
        body: "표와 서식을 지킨 채 읽고, 13종으로 가르고, 고정된 JSON 스키마로 값을 꺼내고, 그 값이 원문 어디에 있었는지 좌표로 돌려줍니다. 워크플로가 Config 로 굳어 있어 같은 문서는 같은 모양으로 나옵니다.",
        does: [
          "HWP·PDF·이미지·오피스 문서를 표 구조째로 파싱",
          "분류 결과로 갈라지는 분기 추출 (요건·서류·배점·마감)",
          "json_schema 로 필드 이름과 타입을 고정",
          "요소마다 정규화 좌표 — 근거 하이라이트의 재료",
        ],
      },
      {
        name: "Solar",
        role: "탐색 · 판단 · 계획 · 브라우저 조작",
        body: "문서 밖의 일을 합니다. 무엇을 원하는지 읽고, 링크 40개 중 무엇을 열지 고르고, 두 출처의 항목이 같은 것인지 판단하고, 실제 신청 사이트를 보고 누릅니다. 작업 무게에 따라 두 크기를 갈라 씁니다.",
        does: [
          "자연어 요청 해석 · 링크 선별 · 착수 판정",
          "두 출처에서 나온 입력 항목을 하나로 병합",
          "마감일에서 역산한 계획 · 제출 서류 작성",
          "DOM 스냅샷을 읽고 폼을 채우는 도구 루프",
        ],
      },
    ],
    sizes: {
      headline: "크기를 작업 무게로 가릅니다",
      body: "분류·판정·한 줄 서술처럼 큰 모델을 써도 답이 같은 일에는 작은 모델을 씁니다. 어느 호출이 어느 크기를 쓰는지는 표에 있습니다.",
      rows: [
        {
          tier: "solar-mini",
          where: "intake · judge · narrate",
          why: "분류와 한 줄 서술. 큰 모델을 써도 답이 같습니다",
        },
        {
          tier: "solar-pro4",
          where: "research · reconcile · plan · documents · browser · curate",
          why: "판단이 걸린 일. 도구 루프와 긴 문서 작성이 여기 있습니다",
        },
        {
          tier: "solar-embedding-2",
          where: "지식베이스 조회 · 저장",
          why: "query 와 passage 를 갈라 씁니다. 섞으면 정확도가 떨어집니다",
        },
      ],
    },
  },

  // ── 0.5 읽을 파일을 구해 오는 길 ─────────────────────────────────────
  journey: {
    eyebrow: "0.5 · 왕복",
    headline: "사용자가 못 찾아도 읽을 파일은 에이전트가 구해 옵니다",
    sub: "「이 공고 우리 회사로 신청해줘」 한 줄과 링크 하나. 사용자가 파일을 올리지 않아도 Solar 가 페이지를 열어 공고문 첨부를 찾아 내려받고, 첨부가 없으면 읽은 내용을 파일로 만듭니다 — 어느 경우든 문서는 Studio 의 Document Parse 를 지납니다. 아래 줄이 바뀔 때마다 담당이 바뀝니다.",
    steps: [
      {
        lane: "solar",
        actor: "solar-mini",
        title: "무엇을 원하는지 읽는다",
        body: "문장에서 의도와 링크를 뽑습니다. 정규식만으로는 「이거 나도 되나?」와 「신청해줘」를 못 가릅니다.",
      },
      {
        lane: "run",
        actor: "크롤러",
        title: "링크를 열어 본다",
        body: "응답을 보고 문서 파일이면 내려받고, HTML 이면 본문·링크·폼 라벨을 남깁니다. 이후 단계가 「파일인지 페이지인지」를 다시 묻지 않습니다.",
      },
      {
        lane: "solar",
        actor: "solar-mini",
        title: "어느 링크가 공고 첨부인가",
        body: "페이지에서 본 링크 최대 40개 중 공고문·신청 양식만 고릅니다. 공고 원본은 대개 본문이 아니라 첨부에 있습니다.",
      },
      {
        lane: "run",
        actor: "합성",
        title: "읽을 파일이 없으면 만든다",
        body: "첨부가 하나도 없으면 Solar 가 정돈한 내용을 PDF 로 찍어 Studio 에 넘깁니다. Document Parse 는 평문을 안 받기 때문입니다. 이게 없으면 링크 하나짜리 입력은 분류·좌표·준비 문서를 전부 잃습니다.",
        badge: "새로 만든 파일",
      },
      {
        lane: "studio",
        actor: "유효성 검사",
        title: "읽고 판단 가능한 모양으로",
        body: "parse → analyze → summarize. 목적·핵심 사실·기한·금액·연락처를 뽑아 하나의 Markdown 으로 정돈합니다.",
      },
      {
        lane: "solar",
        actor: "solar-mini · solar-pro4",
        title: "착수 판정하고 더 찾는다",
        body: "읽을 만한 공고인지 먼저 판정합니다. 그다음 신청 URL 을 찾아 실제로 열고, 폼이 무엇을 묻는지 라벨을 읽습니다.",
      },
      {
        lane: "studio",
        actor: "정보 분석",
        title: "신청 양식으로 구조화",
        body: "parse → classify → 7갈래 extract → brief. 필드마다 입력 종류·필수 여부·원문 근거가 붙고, 요소마다 좌표가 따라옵니다.",
      },
      {
        lane: "solar",
        actor: "solar-pro4",
        title: "두 출처를 하나로 합친다",
        body: "정보 분석의 「성명」과 신청 폼의 「이름」은 같은 항목입니다. 키 병합으로는 못 합쳐 같은 걸 두 번 묻게 됩니다 — 실측 26개 → 11개.",
      },
      {
        lane: "run",
        actor: "지식베이스",
        title: "아는 것은 이미 채워 둔다",
        body: "label 정확 일치를 먼저 보고, 없으면 코사인 유사도로 찾습니다. 「상시근로자 수」로 물어도 「현재 직원 수」로 저장한 값이 붙습니다.",
      },
      {
        lane: "solar",
        actor: "solar-pro4",
        title: "모자란 것만 사람에게 묻는다",
        body: "빈 항목만 남깁니다. 그동안 계획을 세우고 제출 서류를 씁니다 — 발급 서류는 손대지 않습니다.",
      },
      {
        lane: "run",
        actor: "브라우저",
        title: "실제 사이트에서 낸다",
        body: "빈 항목이 0 이고 신청 URL 이 있으면 사람을 거치지 않고 폼을 채워 제출합니다. 캡챠를 만나면 그 자리에서 멈추고 사람을 부릅니다.",
      },
    ],
    lanes: {
      solar: "Solar",
      studio: "Upstage Studio",
      run: "실행 · 데이터",
    },
    /**
     * 되돌아감.
     *
     * 「오케스트레이터가 순서를 정한다」고 뭉뚱그리지 않는다 — 준비 8단계의
     * 순서는 `pipeline.ts` 가 정하고, **순서를 모델이 정하는 곳은 브라우저
     * 도구 루프 하나다.** 화면이 「오케스트레이터」라고 부르는 서술자는 흐름을
     * 정하지 않고 무슨 일이 일어났는지 쓴다. 그 구분을 흐리면 검증하러 온
     * 사람이 코드에 없는 것을 찾게 된다.
     */
    loop: {
      headline: "신청 단계는 앞으로만 가지 않습니다",
      sub: "여기서부터는 순서를 코드가 아니라 모델이 정합니다. 브라우저는 화면을 읽고 다음 도구를 고르는데, 그중 셋은 이미 지나온 단계를 다시 부르는 통로입니다. 되부른 카드는 화면에서 다시 켜집니다.",
      center: { name: "브라우저 도구 루프", note: "도구 11개 · 최대 40스텝" },
      calls: [
        {
          tool: "askUser",
          to: "데이터",
          body: "채울 값이 없으면 지어내지 않고 사람에게 묻고, 답이 올 때까지 기다립니다. 받은 값은 지식베이스에도 남아 다음 공고에서 다시 묻지 않습니다.",
        },
        {
          tool: "makeFile",
          to: "파일",
          body: "업로드 칸이 요구하는 서류를 그 자리에서 만듭니다. 형식은 칸의 `accept` 를 보고 고릅니다. 발급 서류는 여기서도 만들지 않습니다.",
        },
        {
          tool: "replan",
          to: "계획",
          body: "같은 곳에서 두 번 막히면 계획을 다시 짭니다. 새 순서를 받아 그 자리에서 이어갑니다.",
        },
      ],
      switchOver: {
        headline: "도중에 엔진을 갈아탑니다",
        body: "캡챠는 제출을 누른 뒤에 뜨기도 합니다. 그래서 조작할 때마다 다시 확인하고, 나타나면 자동 모드를 그 자리에서 끊고 사람이 직접 누를 수 있는 수동 세션으로 갈아탑니다. 화면에도 `mode` 이벤트로 그대로 보입니다.",
      },
      file: "src/app/(app)/app/start/apply/route.ts",
    },

    /** 앞으로만 가지 않는 자리. 전부 코드에 있는 경로다 */
    detours: {
      headline: "되돌아가는 길 여덟 개",
      sub: "실패와 회복도 흐름의 일부입니다. 어느 자리에서 어떤 조건에 되돌아가는지를 적어 둡니다 — 「알아서 잘 됩니다」는 검증할 수 없는 문장입니다.",
      rows: [
        {
          what: "브라우저 되부름",
          when: "폼이 준비에 없던 값·서류를 요구하거나, 같은 곳에서 두 번 막힘",
          how: "`askUser` · `makeFile` · `replan` 로 데이터·파일·계획을 다시 부른다",
          where: "start/apply/route.ts",
        },
        {
          what: "모드 전환",
          when: "캡챠가 보이면 (조작할 때마다 확인)",
          how: "자동 Playwright 를 끊고 사람이 누를 수 있는 수동 세션으로 갈아탄다",
          where: "lab/notice/_lib/captcha.ts",
        },
        {
          what: "단계 재시도",
          when: "자료 조사·정보 분석·계획이 실패",
          how: "1회, 상한 90초. 시간 초과는 다시 하지 않는다 — 두 번째에 갑자기 빨라질 이유가 없다",
          where: "start/_lib/pipeline.ts",
        },
        {
          what: "계약 복구",
          when: "구조화 출력이 되묻기 규칙을 어김",
          how: "무엇이 왜 틀렸는지 적어 한 번 되묻는다. 두 번은 하지 않는다",
          where: "lib/ai/gateway.ts",
        },
        {
          what: "엔진 강등",
          when: "Studio job 실패·에이전트 미설정",
          how: "같은 단계를 Solar 로 다시 시도한다. 어느 경로였는지 화면 `via` 에 남는다",
          where: "start/_lib/summarize.ts · analyze.ts",
        },
        {
          what: "건너뛰기",
          when: "요약이 `bad` 로 판정",
          how: "뒤 단계를 skip 으로 표시하고 이유를 말한 뒤 끝낸다. 조용히 닫지 않는다",
          where: "start/_lib/pipeline.ts",
        },
        {
          what: "이어받기",
          when: "이전 실행이 중간에 죽음",
          how: "세션 스냅샷으로 끝난 단계를 건너뛰고 안 끝난 곳부터. 서류만은 다시 만든다",
          where: "start/_lib/pipeline.ts",
        },
        {
          what: "사람 대기",
          when: "빈 항목이 남음 (슬랙)",
          how: "스레드가 `asking` 으로 열린 채 멈췄다가, 답이 오면 그 자리에서 이어간다",
          where: "lab/relay/_lib/host.ts",
        },
      ],
      note: "Studio 워크플로 안의 `validate` 스텝은 예외입니다 — 추출 결과가 쓸 만한지 판정해 green·yellow·red 를 남기지만 **흐름을 되돌리지는 않습니다.** 되돌릴 수 있다고 적으면 로그에서 찾을 수 없는 동작을 찾게 됩니다.",
    },

    close:
      "왕복이 요점입니다. Studio 가 낸 구조를 Solar 가 읽고 다음에 무엇을 찾을지 정하고, Solar 가 찾아온 것을 다시 Studio 가 구조로 바꿉니다. 한쪽만으로는 어느 지점에서도 멈춥니다.",
    synth: {
      headline: "첨부가 없어도 Studio 를 지나게 하려고",
      body: "이게 없으면 파일을 준 입력과 링크만 준 입력이 다른 성능을 냅니다. 첨부가 없으면 Studio 를 한 번도 안 타고 Solar 가 요약에서 필드를 추측하게 됩니다 — 분류 분기도, 준비 문서도, 원문 좌표도 없이. 그런데 그때도 읽을 내용은 이미 있습니다. Document Parse 가 평문을 안 받을 뿐입니다.",
      file: "src/app/(app)/app/start/_lib/analyze.ts",
    },
  },

  // ── 1. 준비 파이프라인 ───────────────────────────────────────────────
  flow: {
    eyebrow: "1 · 준비 파이프라인",
    headline: "여덟 단계가 SSE 로 흐릅니다",
    sub: "단계 하나가 실패해도 가능한 한 다음으로 갑니다 — 정보 분석이 죽어도 자료 조사가 뽑은 항목으로 신청은 됩니다. 멈추는 건 둘뿐입니다: 입력을 못 읽었거나, 요약이 bad 로 판정됐거나.",
    file: "src/app/(app)/app/start/_lib/pipeline.ts",
    stages: [
      {
        id: "intake",
        card: "목표 파악",
        title: "입력 정리",
        body: "파일·링크·문장을 한 모양으로 모읍니다. 어떤 입력인지 분류하고, 공고 페이지의 링크 목록에서 공고문·신청 양식 첨부만 고릅니다.",
        engine: "solar-mini",
        tier: "small",
        lane: "interactive",
        guard: "repair 0",
      },
      {
        id: "summarize",
        card: "수집 자료 분석",
        title: "유효성 검사",
        body: "Upstage Studio 유효성 검사 에이전트가 parse → analyze → summarize 를 돌려 Markdown 요약 하나를 만듭니다. 실패하면 Document Parse + Solar 로 떨어지고, 그 사실이 화면 `via` 에 그대로 적힙니다.",
        engine: "Studio 유효성 검사 → solar-pro4",
        tier: "large",
        lane: "studio",
        guard: "Markdown 아니면 폴백",
      },
      {
        id: "judge",
        card: "목표 파악",
        title: "착수 판정",
        body: "요약이 공고로 읽을 만한지 판정합니다. bad 면 뒤 단계를 전부 skip 으로 표시하고 이유를 말한 뒤 끝냅니다 — 조용히 닫지 않습니다.",
        engine: "solar-mini",
        tier: "small",
        lane: "interactive",
        guard: "repair 0",
      },
      {
        id: "research",
        card: "배경 정보 수집",
        title: "자료 조사",
        body: "요약과 링크 목록에서 신청 URL·첨부 파일을 고르고 실제로 받아 옵니다. 신청 페이지의 폼을 읽어 입력 항목을 뽑아냅니다.",
        engine: "solar-pro4",
        tier: "large",
        lane: "interactive",
        guard: "isoDate · noPlaceholder · uniqueBy",
      },
      {
        id: "analyze",
        card: "수집 자료 분석",
        title: "정보 분석",
        body: "Upstage Studio 정보 분석 에이전트가 모인 파일 전부를 parse → classify → 7갈래 extract → brief 로 돌립니다. 신청 유형별 필드 목록과 준비 문서, 그리고 원문 좌표가 함께 나옵니다.",
        engine: "Studio 정보 분석 → solar-pro4",
        tier: "large",
        lane: "studio",
        guard: "noPlaceholder(fields[].label)",
      },
      {
        id: "prefill",
        card: "필요 데이터 수집",
        title: "선채움",
        body: "두 출처의 항목을 모델이 병합한 뒤, 기업 지식베이스에서 값을 찾아 채웁니다. label 정확 일치를 먼저 보고, 없으면 pgvector 코사인 유사도로 찾습니다.",
        engine: "solar-pro4 (병합) + solar-embedding-2",
        tier: "large",
        lane: "interactive",
        guard: "유사도 하한 0.50",
      },
      {
        id: "plan",
        card: "계획 수립",
        title: "계획",
        body: "마감일에서 역산해 담당(사람·에이전트·브라우저)과 기한이 붙은 순서를 세웁니다. 서류 작성과 나란히 돕니다.",
        engine: "solar-pro4",
        tier: "large",
        lane: "interactive",
        guard: "isoDate(future)",
      },
      {
        id: "documents",
        card: "파일 에디터",
        title: "서류",
        body: "제출 서류를 「작성」과 「발급」으로 가릅니다. 작성만 만들고 발급 서류는 손대지 않습니다 — 만들면 위조입니다. 공고가 준 지정 서식이 있으면 새로 쓰지 않고 그것을 채웁니다.",
        engine: "solar-pro4",
        tier: "large",
        lane: "batch",
        guard: "obtainOnly — 유일한 reject",
      },
    ],
    apply: {
      title: "신청 실행",
      body: "빈 항목이 0 이고 신청 URL 이 있으면 사람을 거치지 않고 브라우저가 바로 신청합니다. 캡챠를 만나면 그 자리에서 멈추고 사람을 부릅니다.",
      engine: "solar-pro4 · 도구 루프 40스텝",
      lane: "browser",
    },
    parallel: [
      {
        title: "계획 ∥ 서류",
        body: "둘 다 마스터 테이블이 확정된 뒤 시작하지만 서로의 출력을 보지 않습니다. 직렬로 두면 짧은 쪽만큼이 그냥 사라집니다.",
      },
      {
        title: "분류 ∥ 지정 서식",
        body: "공고가 준 지정 서식을 채우는 일은 분류 모델의 결과와 무관합니다. 직렬로 두면 분류가 한 번 흔들릴 때 서식 채우기까지 같이 사라집니다.",
      },
      {
        title: "문서 n편 동시 작성",
        body: "문서끼리 서로를 참조하지 않습니다. batch 레인(상한 2)이 동시 편수를 잡습니다.",
      },
    ],
    resilience: [
      "단계 상한 240초. 넘기면 그 단계만 죽고 파이프라인은 계속 갑니다.",
      "요약 직후 세션 행을 만들고 단계마다 덮어씁니다 — 탭을 닫아도 준비는 끝까지 가고, 「지난 목표」에서 이어받습니다.",
      "죽은 실행은 끝난 단계를 건너뛰고 재개합니다. 다만 서류는 다시 만듭니다 — 산출물 경로가 임시 폴더라 「있다고 말하고 없는 것」이 훨씬 나쁘기 때문입니다.",
    ],
  },

  // ── 2. Upstage Studio ────────────────────────────────────────────────
  studio: {
    eyebrow: "2 · Upstage Studio",
    headline: "문서 처리의 중심은 Studio 워크플로입니다",
    sub: "Config 를 화면에서 클릭해 만들지 않습니다. DAG 를 TypeScript 로 두고 `pnpm studio:provision` 으로 API 에 올립니다. 그래서 워크플로가 diff 로 보이고, 리뷰되고, 같은 구성을 언제든 다시 만들 수 있습니다. Config 는 불변이라 고칠 때마다 새 Config 가 생기고 — 버전 관리와 감사 추적이 공짜로 따라옵니다.",
    agents: [
      {
        name: "공고 처리",
        purpose: "공고문을 13종으로 분류하고 요건·서류·배점·마감을 뽑습니다",
        agentId: "agt_VUBEVuk2mXQrrTxYnLL93w",
        configId: "cfg_EnXdSDnc6VRVdCtEUayNHo",
        envKey: "UPSTAGE_AGENT_ID",
        provision: "pnpm studio:provision",
        source: "src/lib/studio-workflow.ts",
        steps: 7,
      },
      {
        name: "유효성 검사",
        purpose: "문서를 판단 가능한 Markdown 요약 하나로 정돈합니다",
        agentId: "agt_atmMQXMKxDZkjqSkdiVpDq",
        configId: "cfg_iCdJf9NLuuNh4sGtTQrVjw",
        envKey: "UPSTAGE_VALIDATION_AGENT_ID",
        provision: "pnpm studio:provision:validation",
        source: "src/app/(labs)/lab/validation/_lib/workflow.ts",
        steps: 3,
      },
      {
        name: "정보 분석",
        purpose: "신청 유형을 7갈래로 가르고 양식 필드와 준비 문서를 만듭니다",
        agentId: "agt_kKEZDyyAzn84oo3AsgpWj9",
        configId: "cfg_L9bTyjc9Trws2jq7NMqGot",
        envKey: "UPSTAGE_ANALYSIS_AGENT_ID",
        provision: "pnpm studio:provision:analysis",
        source: "src/app/(labs)/lab/analysis/_lib/workflow.ts",
        steps: 10,
      },
    ],
    /**
     * 어떤 입력이든 문서 처리는 Studio 를 지난다.
     *
     * 트랙 요건이 「Studio must power the core document-processing stages」라
     * 이 표가 곧 그 답이다. 링크·문장 입력에서 Studio 호출이 0회였던 구간을
     * 없앤 뒤에야 세 줄이 모두 채워졌다(`analyze.ts` 의 합성 경로).
     */
    coverage: {
      headline: "입력이 무엇이든 문서 처리는 Studio 가 합니다",
      sub: "파일·링크·문장 어느 쪽으로 시작해도 Document Parse 를 지납니다. 첨부가 없으면 Solar 가 정돈한 내용을 PDF 로 만들어 넣기 때문입니다.",
      head: ["입력", "Studio 가 받는 것", "job", "나오는 것"],
      rows: [
        [
          "공고문 파일 업로드",
          "원본 그대로 (HWP·PDF·이미지·오피스)",
          "2",
          "요약 · 분류 · 필드 · 준비 문서 · 좌표",
        ],
        ["공고 페이지 링크", "페이지에서 찾아 내려받은 첨부", "2", "같음"],
        ["링크만 있고 첨부가 없음", "읽은 내용을 PDF 로 만들어 넣음", "2", "같음"],
        ["문장만", "정돈한 내용을 PDF 로 만들어 넣음", "1", "분류 · 필드 · 준비 문서"],
      ],
      note: "job 2회는 유효성 검사와 정보 분석입니다. 요약이 올린 파일은 분석이 `file_id` 로 재사용하므로 같은 문서를 두 번 파싱하지 않습니다 — Document Parse 는 페이지 과금입니다.",
    },

    /**
     * API 를 실제로 두드려 확인한 것.
     *
     * 스펙에 없거나 스펙과 다른 것만 적는다. 문서를 읽어서 알 수 있는 것은
     * 여기 넣지 않는다 — 그건 Upstage 쪽이 우리보다 잘 안다.
     */
    api: {
      headline: "Studio API 에서 확인한 것",
      sub: "config 를 코드로 만들다 보면 스펙 밖의 계약이 드러납니다. 아래는 전부 실제 요청과 응답으로 확인한 것입니다.",
      rows: [
        {
          what: "`validate` 조건식",
          body: "연산자 `eq neq gt gte lt lte filled empty contains matches`. 피연산자는 `{path}` `{const}` `{node}` `{nodeType+nodeName}` 중 정확히 하나. `{logic, conditions}` 로 AND/OR 묶음이 됩니다",
        },
        {
          what: "`review` 는 터미널 노드",
          body: "`next_steps` 를 비워야 config 가 생성됩니다 — 사람 확인 지점 뒤에 자동 스텝을 둘 수 없습니다",
        },
        {
          what: "`merge` 의 전제",
          body: "`split: true` 인 `document-classify` 가 **정확히 하나** 있어야 합니다. 없으면 config 생성이 거절됩니다",
        },
        {
          what: "`match` 의 대상",
          body: "`targets[].collection_id` 로 비교 대상을 가리킵니다. 이 환경에서 대상 컬렉션을 만들 수단이 없어 보류했습니다",
        },
        {
          what: "HTTP Export",
          body: "이 환경에서는 꺼져 있어(`feature_disabled`) 결과를 밖으로 밀어내는 대신 우리가 폴링합니다",
        },
      ],
      used: {
        headline: "우리가 쓰는 스텝",
        body: "`document-parse` → `document-classify` → `information-extract` → `validate` → `instruct`. 세 에이전트가 이 다섯 가지로 20스텝을 이룹니다.",
      },
    },

    /**
     * 검사 스텝.
     *
     * 「추측하지 않는다」는 제품 주장을 Studio 그래프 안에서 증명하는 자리다.
     */
    validate: {
      headline: "추출 결과를 Studio 안에서 검사합니다",
      sub: "값이 맞는지가 아니라 **빈 채로 다음 단계에 넘어가는지**를 봅니다. 필드 목록이 빈 채 흘러가면 사용자는 질문이 하나도 없는 빈 화면을 보고, 브라우저는 채울 값이 없어 헛돕니다 — 그때 원인을 되짚기가 가장 어렵습니다.",
      key: "조건식의 뿌리는 스텝 이름이 아니라 타입 별칭 `extract` 입니다. 그래서 추출 분기가 일곱이어도 **검사는 하나면 됩니다.**",
      checks: [
        {
          name: "제목이 있다",
          severity: "error",
          cond: "`extract.applicationTitle.value` filled",
        },
        {
          name: "입력 항목이 하나라도 있다",
          severity: "error",
          cond: "`extract.fields.value[0].key` filled",
        },
        {
          name: "첫 항목에 한글 라벨이 있다",
          severity: "error",
          cond: "`extract.fields.value[0].label` filled",
        },
        {
          name: "추출 신뢰도가 0.7 이상",
          severity: "warning",
          cond: "`extract.applicationTitle.confidence` gte 0.7",
        },
        {
          name: "신청 유형이 분류됐다",
          severity: "warning",
          cond: "`extract.applicationType.value` filled",
        },
      ],
      verdict:
        "판정은 green · yellow · red 로 옵니다. `error` 가 걸리면 red, `warning` 만이면 yellow 입니다. 실패한 검사만 화면에 적습니다 — 통과한 것까지 늘어놓으면 「이상 없음」 스무 줄에 실패 한 줄이 묻힙니다.",
      reason:
        "이유 문자열에 좌변의 실제값이 들어 있어 「왜 red 인가」를 되물을 필요가 없습니다.",
    },

    stepTypes: [
      {
        type: "document-parse",
        body: "HWP·PDF·DOCX·PPTX·XLSX 는 물론 스캔본과 사진도 `ocr: auto` 로 읽어 표와 서식을 지킨 채 HTML/Markdown 으로 냅니다. `coordinates: true` 로 요소마다 정규화 좌표(0~1)를 받습니다 — 근거 하이라이트의 재료입니다.",
        opts: "ocr: auto · lang: ko · merge_multipage_tables · coordinates",
      },
      {
        type: "document-classify",
        body: "json_schema 의 `oneOf` 로 클래스를 고정합니다. 각 클래스의 `description` 에 경계 판정 규칙을 넣는 것이 정확도를 좌우합니다. `split: true` 면 한 파일에 섞인 여러 문서를 쪼개 각각 흘려보냅니다.",
        opts: "confidence · split · json_schema(oneOf)",
      },
      {
        type: "information-extract",
        body: "분류 결과로 갈라진 분기마다 강조점만 다른 같은 스키마를 씁니다. `location: true` 로 값의 위치가, `mode: enhanced` 로 표·다단 레이아웃 정확도가 올라갑니다.",
        opts: "confidence · location · mode: enhanced",
      },
      {
        type: "instruct",
        body: "앞 스텝 결과가 자동으로 컨텍스트에 실립니다. 「원문에서 확인되지 않은 것만 골라라」처럼 추출 위에 얹는 판단을 여기서 합니다.",
        opts: "data.input 배열 · json_schema",
      },
    ],
    schemaRules: [
      "1단계 properties 에 object 를 넣을 수 없습니다 — array of object 로 감쌉니다",
      "최대 깊이 3: root → array → object → primitive",
      "property 이름은 `_` 로 시작할 수 없습니다",
      "document-parse 가 반드시 첫 스텝이고 `is_first` 는 정확히 하나입니다",
      "순서는 DP → DC → IE. document-classify 가 IE 뒤에 올 수 없습니다",
    ],
    run: {
      headline: "실행은 동기가 아닙니다 — 세 번 왕복합니다",
      steps: [
        {
          call: "POST /v2/files",
          body: "file, purpose=user_data → file_id. 요약 단계가 올린 파일은 분석 단계가 `fileId` 로 재사용합니다 — Document Parse 는 페이지 과금이라 20쪽 공고가 두 번 올라가면 40쪽이 됩니다.",
        },
        {
          call: "POST /v2/responses",
          body: "model=<agentId>, input_file → job_id. Config 의 DAG 가 이 시점에 적용됩니다.",
        },
        {
          call: "GET /v2/responses/{id}",
          body: "2초 간격 폴링, 상한 180초(정보 분석은 240초). 폴링 중에는 `include=last` 로 상태만 받고, 완료된 뒤 딱 한 번 `include=all` 로 전체 스텝을 받습니다 — 좌표까지 실린 응답을 90번 왕복시킬 이유가 없습니다.",
        },
      ],
    },
    /**
     * 호출 계약.
     *
     * 「문서가 틀렸다」로 적지 않는다 — 읽는 사람이 Upstage 쪽이다. 우리가
     * 지킨 계약과, 안 지켰을 때 어디서 증상이 나는지만 적는다. 증상이 원인과
     * 떨어진 곳에서 나오는 것들이라 그 대응이 실제로 쓸모가 있다.
     */
    contracts: {
      headline: "호출할 때 지킨 계약",
      sub: "구현하며 하나씩 맞춰 본 것입니다. 증상이 원인과 떨어진 자리에서 나오는 것들이라 함께 적습니다.",
      items: [
        {
          where: "classify 분기 조건",
          rule: '`condition.field` 는 `"text"`, 연산자는 `==`, 값은 leaf 라벨',
          symptom: "다른 필드명을 주면 400 — 조건이 그대로 되돌아옵니다",
        },
        {
          where: "instruct 입력",
          rule: "`data.input` 배열 (`role` · `content[].input_text`)",
          symptom: "배열이 아니면 job 이 `queries are required for instruct` 로 끝납니다",
        },
        {
          where: "include",
          rule: "`GET /v2/responses/{id}?include=all` — 조회 쿼리 파라미터",
          symptom: "생성 요청 본문에 넣으면 마지막 스텝만 돌아옵니다",
        },
        {
          where: "스텝 결과",
          rule: "`output[].model` 이 스텝 이름, 값은 `content[0].text` 에 문자열",
          symptom: "JSON 을 낸 스텝도 한 번 파싱해야 합니다",
        },
        {
          where: "citations",
          rule: "`additional_values` 는 문자열이라 파싱한 뒤 `citations[].node_index` 로 parse 요소 `id` 를 찾습니다",
          symptom: "객체로 읽으면 근거 하이라이트가 통째로 빕니다",
        },
        {
          where: "OCR 단어 좌표",
          rule: "단어마다 `boundingBox` (단수)",
          symptom: "복수형으로 읽으면 단어가 전부 버려져 화면이 빈 것처럼 보입니다",
        },
      ],
    },
    /**
     * 운영 규칙.
     *
     * 「여기가 이상하다」가 아니라 「우리는 이렇게 맞춰 두었다」로 적는다.
     * 셋 다 같은 축에서 나온 것이다 — 파일과 에이전트가 같은 계정·같은
     * 소유 범위에 있어야 job 이 파일을 읽는다.
     */
    ops: [
      {
        title: "에이전트와 파일을 같은 키 아래 둡니다",
        body: "Agent·Config 는 만든 키의 계정에 속합니다. 키를 바꾸면 `pnpm studio:provision` 을 다시 돌려 Config 를 만들고 환경변수를 갱신합니다 — 로컬과 배포 양쪽 다.",
      },
      {
        title: "에이전트는 코드로 만든 것만 씁니다",
        body: "`/v2/files` 로 올린 파일과 같은 소유 범위에 있어야 job 이 그 파일을 읽습니다. `pnpm studio:provision` 이 만든 에이전트를 쓰고, 화면에서 만든 것은 쓰지 않습니다.",
      },
      {
        title: "Config 가 불변이라 이력이 남습니다",
        body: "고칠 때마다 새 Config 가 생깁니다. 워크플로가 코드에 있고 Config ID 가 배포마다 남으므로, 어느 버전으로 돌았는지를 나중에 되짚을 수 있습니다.",
      },
    ],
  },

  // ── 3. 게이트웨이 ────────────────────────────────────────────────────
  gateway: {
    eyebrow: "3 · Solar 오케스트레이션",
    headline: "Solar 호출은 전부 한 자리를 지납니다",
    sub: "모델을 부르는 코드가 한 자리뿐입니다. 그래서 계측·티어링·계약·검증·복구·취소가 호출마다 붙는 것이 아니라 그 자리 하나에 붙어 있습니다.",
    file: "src/lib/ai/gateway.ts",
    contract: {
      headline: "필드 계약을 손으로 쓰지 않습니다",
      body: "Upstage 는 `response_format: json_object` 만 받고 zod 스키마를 모델에 넘기지 않습니다. 그래서 계약을 프롬프트에 직접 박아야 하는데, 손으로 적으면 스키마를 고치고 문장을 안 고쳤을 때 모델이 옛 계약을 따릅니다. `contractOf()` 가 스키마에서 문장을 만들면 그 사고가 구조적으로 불가능해집니다.",
      extra:
        "`response_format: json_object` 는 메시지에 「json」이라는 낱말을 요구합니다. `systemFor()` 가 반드시 넣으므로 사람이 기억할 일이 없습니다.",
      file: "src/lib/ai/contract.ts",
    },
    loose: {
      headline: "스키마는 느슨하게 둡니다",
      body: "`.nullish()` 는 실수가 아니라 정책입니다. LLM 은 값이 없으면 키를 생략하고, 엄격하게 굴면 필드 하나 때문에 배열 전체가 폐기됩니다. 조이는 일은 `normalize` 와 `verify` 가 합니다.",
    },
    verify: {
      headline: "규칙으로 답할 수 있으면 모델에게 묻지 않습니다",
      sub: "스키마는 「문자열인가」까지만 봅니다. 「2026년 9월 중」은 `deadline` 으로 완벽한 문자열이고, 그대로 계획과 기한 역산까지 흘러갑니다. 사이트마다 프롬프트에 규칙을 더하면 규칙이 사이트 수만큼 늘고 서로 부딪치므로, 규칙으로 답할 수 있는 것은 규칙에 둡니다.",
      file: "src/lib/ai/verify.ts",
      rules: [
        {
          name: "isoDate",
          severity: "drop",
          body: "YYYY-MM-DD 인가, 그리고 달력에 실제로 있는 날인가. `2026-02-31` 은 형식을 통과합니다. 과거 날짜도 잡습니다.",
        },
        {
          name: "oneOf",
          severity: "drop",
          body: "정해진 값 목록 안에 있는가. 분류 키와 화이트리스트가 갈리는 사고를 막습니다.",
        },
        {
          name: "noPlaceholder",
          severity: "drop",
          body: "예시 값이 항목으로 올라온 것. 「010-0000-0000」을 항목으로 만들면 사용자에게 그걸 묻게 됩니다.",
        },
        {
          name: "unitMatch",
          severity: "drop",
          body: "「총사업비 (천원)」에 1억을 넣으려면 100000 입니다. 라벨의 단위와 값의 자릿수를 맞춥니다.",
        },
        {
          name: "obtainOnly",
          severity: "reject",
          body: "발급 서류를 「작성」으로 분류했는가. 사업자등록증을 우리가 써 주면 값 하나 틀린 것과 급이 다릅니다 — 그래서 유일하게 되묻습니다.",
        },
        {
          name: "uniqueBy",
          severity: "drop",
          body: "같은 항목이 두 번 올라왔는가. 병합 뒤에도 남는 중복을 여기서 걷어냅니다.",
        },
      ],
    },
    retries: {
      headline: "재시도가 세 층입니다",
      sub: "층마다 고치는 실패가 다릅니다. 한 층으로 다 덮으려 하면 비싼 것을 헛되이 두 번 하거나, 싼 것을 한 번도 안 다시 합니다.",
      layers: [
        {
          who: "AI SDK",
          what: "전송 실패 (429 · 5xx)",
          how: "2회",
          why: "상류가 잠깐 흔들린 경우. 우리가 할 일이 없습니다",
        },
        {
          who: "게이트웨이",
          what: "계약 위반 (reject 규칙)",
          how: "1회",
          why: "두 번째로 같은 계약을 어기는 모델은 세 번째에도 어깁니다",
        },
        {
          who: "파이프라인",
          what: "단계 전체 실패",
          how: "research · analyze · plan 만 1회, 상한 90초",
          why: "싼 것만 고릅니다. 실측 research 22초 · analyze 16초 · plan 31~64초",
        },
      ],
      note: "시간 초과는 다시 하지 않습니다. 같은 방식으로 또 기다리면 그만큼 늦어질 뿐이고, 오래 걸리던 것이 두 번째에 갑자기 빨라질 이유가 없습니다. `documents`(45~120초)와 `summarize`(Studio job)는 재시도가 준비 시간을 통째로 배로 만들어 뺐습니다.",
    },
    repair: {
      headline: "복구는 한 번뿐입니다",
      body: "두 번째로 같은 계약을 어기는 모델은 세 번째에도 어깁니다. 그때는 결정론적 폴백이 더 쌉니다. 폴백이 있는 호출부는 아예 0 으로 둡니다.",
      severity:
        "`drop` 은 그 값만 버리고 되묻지 않습니다. 값 하나 때문에 왕복을 더 하는 것이 그 값보다 비쌉니다. 버린 사실은 `CallResult.issues` 로 호출부에 그대로 넘어갑니다 — 조용히 지우지 않습니다.",
    },
    tiers: {
      headline: "티어는 표로 둡니다",
      body: "프로바이더가 바뀌어도 어느 호출이 어느 크기를 쓸지는 그대로입니다. 작은 티어가 없는 프로바이더에서는 기본 모델로 승격합니다 — 없는 배포 이름을 보내면 404 이고, 그건 절감이 아니라 장애입니다.",
      rows: [
        {
          provider: "upstage",
          base: "https://api.upstage.ai/v1",
          large: "solar-pro4",
          small: "solar-mini",
        },
        {
          provider: "azure",
          base: "<resource>.services.ai.azure.com/openai/v1",
          large: "배포 이름",
          small: "(승격)",
        },
        {
          provider: "openai",
          base: "https://api.openai.com/v1",
          large: "gpt-4.1-mini",
          small: "gpt-4.1-nano",
        },
        {
          provider: "backendai",
          base: "BACKENDAI_BASE_URL",
          large: "배포 이름",
          small: "(승격)",
        },
        {
          provider: "custom",
          base: "LLM_BASE_URL",
          large: "LLM_MODEL",
          small: "LLM_MODEL_SMALL",
        },
      ],
      note: "트랙이 정해지면 환경변수만 바꿉니다 — 애플리케이션 코드는 건드리지 않습니다. Azure 는 Bearer 가 아니라 `api-key` 헤더라 어댑터가 두 헤더를 모두 보냅니다.",
    },
    narrator: {
      headline: "지금 무슨 일이 일어나는지 사람 말로 씁니다",
      body: "카드마다 기계 로그(`parse → classify → extract-grant`)를 흘리면 개발자만 읽습니다. 사용자가 알아야 하는 것은 무엇을 알아냈고 그래서 다음이 무엇인가입니다.",
      points: [
        "단계마다 따로 쓰지 않고 **하나가 이어서** 씁니다. 그래야 「자료 조사에서 신청 URL 을 못 찾아 계획에서 사람에게 묻기로 했다」처럼 앞뒤가 이어집니다.",
        "**지어내지 않습니다.** 사실은 코드가 산출물에서 뽑아 넘기고, 서술자는 그것만 가지고 씁니다.",
        "값을 넘기지 않습니다. 화면 문구 한 줄을 만드는 호출에 사업자등록번호·생년월일을 실을 이유가 없습니다 — 필요한 것은 무엇이 채워졌는가입니다.",
        "실패를 숨기지 않습니다. 무엇이 막혔고 그래서 어떻게 할 것인지 씁니다.",
      ],
      file: "src/app/(app)/app/start/_lib/narrator.ts",
    },
    tasks: {
      headline: "임베딩 · 문서 API",
      rows: [
        {
          name: "solar-embedding-2-passage",
          body: "저장하는 기억. 1024차원, 8K 컨텍스트",
        },
        {
          name: "solar-embedding-2-query",
          body: "찾을 때의 질의. 섞으면 정확도가 떨어집니다",
        },
        { name: "Document Parse", body: "Studio 가 없을 때의 폴백 경로" },
        { name: "OCR", body: "수동 브라우저 모드의 화면 읽기. 키가 없으면 tesseract" },
      ],
    },
  },

  // ── 4. 자원 관리 ────────────────────────────────────────────────────
  runtime: {
    eyebrow: "4 · 자원 · 계측",
    headline: "동시에 몇 개까지 돌릴지 정해 둡니다",
    sub: "병렬화는 상한 없이 넣으면 개선이 아니라 새 장애입니다. 신청 한 건이 캡챠 사전 탐지 + 본 실행으로 브라우저 둘을 띄우고, PDF 렌더는 문서마다 하나 더 엽니다 — 문서 3편을 병렬로 바꾸는 순간 Chromium 6개입니다.",
    lanesFile: "src/lib/ai/lanes.ts",
    lanes: [
      {
        name: "studio",
        limit: 3,
        body: "업로드 → job → 폴링이라 한 건이 수십 초 매달립니다. 파일 세 개짜리 공고를 한 번에 처리하되 상류 rate limit 을 안 건드리는 선.",
      },
      { name: "interactive", limit: 4, body: "사람이 기다리는 모델 호출." },
      { name: "batch", limit: 2, body: "사람이 당장 안 보는 것 — 문서 작성처럼." },
      {
        name: "browser",
        limit: 2,
        body: "수명이 정해진 Chromium. 캡챠 탐지·자동 신청·PDF 렌더 셋이 같은 레인을 씁니다. 종류별로 나누면 합이 상한을 넘습니다.",
      },
    ],
    desktop: {
      name: "Xvfb 수동 세션",
      limit: 2,
      body: "레인에 넣지 않습니다. 그 세션은 함수가 끝난 뒤에도 최대 15분 살아 있어서, 레인을 잡고 있으면 다음 신청이 「거절」이 아니라 무한 대기가 됩니다. 자기 상한으로 즉시 거절하는 편이 낫습니다.",
    },
    ledger: {
      headline: "계측은 훅 한 자리에 답니다",
      body: "LLM 호출 전부가 `chatModel()` 을 거치고, `createOpenAICompatible` 은 `fetch` 를 통째로 갈아끼울 수 있습니다. 그 자리 하나에 훅을 물리면 모든 왕복이 원장에 잡힙니다 — 새 호출을 추가하는 사람이 계측을 잊을 방법이 없습니다.",
      points: [
        "`AsyncLocalStorage` 로 단계 이름과 실행 id 를 귀속시킵니다. 어느 단계가 비싼지는 추정이 아니라 표가 답합니다.",
        "계측이 요청을 방해하지 않습니다. 훅이 실패해도 호출은 그대로 갑니다.",
        "링버퍼 512개. 영속화하지 않습니다 — 실행 한 건을 프로파일하는 것이 목적입니다.",
      ],
      health:
        "`GET /api/health` 가 최근 10분의 토큰·지연·실패를 작업별로, 그리고 레인 게이지와 컨테이너 메모리를 함께 냅니다.",
    },
    killswitches: {
      headline: "킬스위치",
      sub: "`env` 는 import 시점에 한 번 parse 되므로 런타임 토글은 안 되지만, 배포 변수 하나로 5분 안에 되돌립니다.",
      items: [
        { key: "AI_PREPARE_STEP", body: "브라우저 루프의 컨텍스트 창 관리" },
        { key: "AI_TIER_ROUTING", body: "작업별 모델 티어링" },
        { key: "AI_REPAIR", body: "구조화 출력 복구 루프" },
        { key: "AI_VERIFY", body: "의미 검증(날짜·단위·플레이스홀더)" },
        { key: "AI_SUBMIT_GATE", body: "제출 전 값 대조 게이트" },
      ],
    },
    evals: {
      headline: "임계값은 골든셋으로 지킵니다",
      body: "임계값을 건드리면 47개가 1초 안에 돕니다 — 의미 검증 16개, 재시도 판정 12개, 항목 정리 10개, 근거 매칭 8개. 전부 순수 함수라 모델을 부르지 않습니다.",
    },
  },

  // ── 5. 브라우저 하네스 ───────────────────────────────────────────────
  browser: {
    eyebrow: "5 · 브라우저 하네스",
    headline: "신청은 실제 사이트에서 일어납니다",
    sub: "신청을 시작하기 전에 캡챠가 있는지 먼저 봅니다. 그 한 번의 판단으로 어느 브라우저가 도는지 갈립니다.",
    modes: {
      auto: {
        title: "자동 — 캡챠 없음",
        rows: [
          ["무엇으로", "Playwright (headless)"],
          ["화면 읽기", "DOM 스냅샷"],
          ["코드", "_lib/playwright-agent.ts"],
          ["도구", "11개"],
          ["실측", "4단계 위저드 34스텝 · 2분"],
        ],
      },
      manual: {
        title: "수동 — 캡챠 있음",
        rows: [
          ["무엇으로", "Xvfb + xdotool (CDP 없음)"],
          ["화면 읽기", "스크린샷 OCR"],
          ["코드", "_lib/agent.ts"],
          ["도구", "8개"],
          ["실측", "같은 위저드 60스텝 · 3분 30초에 미완"],
        ],
      },
    },
    why: "DOM 을 직접 읽으면 라벨·현재값·필수 여부·선택지가 정확히 옵니다. 수동 모드가 겪던 문제가 통째로 사라집니다 — 글자 오독, ○/● 를 못 알아봐 라디오를 여섯 번 누르는 진동, 날짜 칸이 `02/02/40315` 로 깨지는 일.",
    tools: [
      { name: "read", body: "화면 스냅샷. 요소마다 ref·라벨·현재값·필수 여부·선택지" },
      { name: "diagnose", body: "무엇이 제출을 막는가 — 브라우저에게 직접 묻습니다" },
      { name: "fill", body: "입력칸 채우기" },
      { name: "click", body: "누르기" },
      { name: "select", body: "선택지 고르기" },
      { name: "scroll", body: "화면 이동" },
      { name: "upload", body: "준비한 파일 붙이기" },
      { name: "submit", body: "제출. `allowSubmit` 없이는 아예 정의되지 않습니다" },
      { name: "askUser", body: "모르는 값을 사람에게 묻기" },
      { name: "makeFile", body: "그 자리에서 서류 만들기" },
      { name: "replan", body: "막히면 계획 다시 세우기" },
    ],
    validity: {
      headline: "케이스마다 프롬프트를 붙이지 않습니다",
      body: "사이트 하나에서 틀릴 때마다 규칙을 한 줄씩 더하면 규칙이 사이트 수만큼 늘고 서로 부딪칩니다. 원인은 브라우저가 이미 아는 것을 모델에게 추측시키는 것입니다. HTML5 검증은 「왜 제출이 안 되는가」를 사이트마다 다른 문구가 아니라 표준으로 답합니다.",
      points: [
        "스냅샷이 `checkValidity()` 와 `validationMessage` 를 함께 싣습니다 → `[미충족 이 입력란을 작성하세요]`",
        "`diagnose` 가 그것을 모아 줍니다 — 못 채운 필수 항목, 빈 파일 칸, 비활성 버튼",
        "준비된 파일에 없는 서류가 막고 있으면 사람 몫이라고 그 자리에서 말합니다. 더 밀어봐야 안 되는 일에 스텝을 태우지 않습니다",
      ],
    },
    serial: {
      headline: "도구 실행을 직렬화합니다",
      body: "모델은 도구를 병렬로 부릅니다. `fill` 여덟 개가 같은 순간에 들어가면 React 폼이 배치 업데이트로 서로를 덮어써 값이 남지 않습니다 — 실측: 같은 여덟 칸을 세 번씩 다시 채우다 끝났고, 도구 로그에는 여덟 줄이 모두 같은 초로 찍혔습니다. `tools` 정의 뒤에 실행을 한 번에 두릅니다. 도구마다 감싸면 새 도구를 더할 때 잊습니다.",
    },
    window: {
      headline: "지나간 화면을 버립니다",
      body: "스냅샷 한 장이 요소 40개 기준 5~6KB 이고 스텝 상한은 40 입니다. append-only 로 쌓이면 누적 입력이 스텝 수의 제곱으로 늘어 마지막 요청이 100KB 를 넘고, 그 대부분이 이미 지나간 화면입니다.",
      key: "오래된 스냅샷은 쓸모없는 정도가 아니라 해롭습니다. 거기 적힌 `e12` 같은 ref 는 지금 화면에 없고, 모델이 그걸 믿고 부르면 튕깁니다. 지운 자리에 그 사실을 적어 두는 편이 낫습니다.",
      cache:
        "최근 2장만 원문으로 두고 나머지는 스텁으로 바꿉니다. 앞쪽 접두는 바이트가 그대로 유지되므로 프롬프트 접두 캐싱과 공존합니다 — 스텝마다 창 밖으로 갓 밀려난 한 건만 새로 치환됩니다.",
      file: "src/lib/ai/window.ts",
    },
    captcha: {
      headline: "캡챠는 우리가 풀지 않습니다",
      body: "사이트가 사람인지 확인하려고 둔 통제이고, 우회해서 낸 신청은 무효 처리될 때 손해가 사용자 쪽입니다. 대신 남은 불편을 없앱니다 — 탭 제목 점멸·브라우저 알림·소리 셋으로 사람을 부릅니다.",
      points: [
        "탐지는 놓치는 쪽이 훨씬 비쌉니다. 놓치면 자동 모드가 캡챠 앞에서 헛돌다 끝나고 사람은 손댈 방법이 없습니다. 잘못 잡으면 느린 길로 갈 뿐입니다 — 그래서 벤더 URL·DOM 선택자·한국어 문구까지 넓게 봅니다.",
        "숨은 recaptcha v3 배지처럼 사람이 풀 게 없는 것은 제외합니다(크기 0이면 무시).",
        "캡챠는 제출을 누른 뒤에 뜨기도 합니다. 그래서 자동 모드는 조작할 때마다 다시 확인하고, 중간에 나타나면 그 자리에서 멈춰 수동 모드로 갈아탑니다.",
        "AI SDK 는 도구 예외를 `tool-error` 로 삼킵니다. throw 만으로는 루프가 안 멈춰서, 신호를 abort 해야 수동 전환이 열립니다.",
      ],
      manualNote:
        "수동 모드는 X 서버로 직접 들어가므로 캡챠 iframe 안도 똑같이 눌립니다 — CDP 로는 못 하던 일입니다. 원격 디버깅 포트가 없으니 `navigator.webdriver` 도 CDP 흔적도 남지 않습니다.",
    },
    stop: "최종 제출 버튼 앞에서 멈추는 것이 기본값입니다. 빈 항목이 0 이고 신청 URL 이 확인된 경우에만 끝까지 갑니다.",
  },

  // ── 6. 사람이 개입하는 지점 ─────────────────────────────────────────
  human: {
    eyebrow: "6 · 사람",
    headline: "사람을 부르는 자리를 정해 두었습니다",
    sub: "끝까지 자동으로 가는 것이 목표가 아닙니다. 사람이 결정해야 하는 것과 사람만 할 수 있는 것을 나누고, 그 자리에서만 멈춥니다.",
    rows: [
      {
        where: "최종 제출 버튼",
        who: "사람이 누른다",
        how: "기본값입니다. 제출 도구는 허용된 실행에서만 정의되고, 그 전에는 모델에게 그런 도구가 있는지조차 보이지 않습니다",
      },
      {
        where: "캡챠",
        who: "사람이 푼다",
        how: "우회하지 않습니다. 화면을 사람에게 넘기고 탭 제목·브라우저 알림·소리 셋으로 부릅니다 — 보고 있지 않아도 알 수 있게",
      },
      {
        where: "폼에 없던 값",
        who: "사람이 답한다",
        how: "브라우저가 `askUser` 로 묻고 답이 올 때까지 기다립니다. 지어내지 않습니다",
      },
      {
        where: "발급 서류",
        who: "사람이 발급받는다",
        how: "사업자등록증·졸업증명서 같은 것은 만들지 않습니다. 무엇이 없어 못 냈는지 보고하고 멈춥니다",
      },
      {
        where: "기억을 고칠 때",
        who: "사람이 말로 시킨다",
        how: "지시가 모호하면 큐레이터가 추측하지 않고 되묻습니다 — 「그거 좀 바꿔줘」는 아무것도 하지 않습니다",
      },
      {
        where: "빈 항목이 남으면",
        who: "사람이 채운다",
        how: "슬랙 스레드가 열린 채 기다립니다. 무엇을 묻고 있는지가 DB 에 남아 서버가 재시작해도 이어집니다",
      },
    ],
    note: "빈 항목이 0 이고 신청 URL 이 확인된 경우에만 사람을 거치지 않고 끝까지 갑니다.",
  },

  // ── 7. 슬랙 릴레이 ──────────────────────────────────────────────────
  relay: {
    eyebrow: "7 · 슬랙",
    headline: "채널에서 멘션 한 번으로 시작합니다",
    sub: "웹에서 쓰는 것과 같은 파이프라인을 다른 입구로 엽니다. 준비를 시작하는 자리가 저장소 전체에 하나뿐이라, 슬랙에서 들어와도 웹과 같은 단계를 같은 순서로 지납니다.",
    file: "src/app/(labs)/lab/relay/_lib/host.ts",
    gate: {
      headline: "웹훅은 방어선이 순서입니다",
      sub: "이 라우트는 `src/proxy.ts` 의 matcher 밖입니다. 인증·인가·멱등을 이 파일이 직접 해야 하고, 하나라도 빠지면 인터넷의 누구나 우리 LLM 키와 Chromium 을 돌릴 수 있습니다.",
      steps: [
        {
          name: "원문 먼저",
          body: "`req.json()` 을 부르면 서명 계산에 쓸 바이트가 사라집니다",
        },
        { name: "서명 검증", body: "맞지 않으면 401" },
        {
          name: "멱등",
          body: "슬랙은 3초 안에 200 을 못 받으면 같은 이벤트를 다시 보냅니다",
        },
        {
          name: "즉시 200",
          body: "실제 처리는 `after` 에서. 우리 파이프라인은 분 단위입니다",
        },
      ],
      note: "모르는 이벤트에도 200 을 줍니다. 오류를 주면 슬랙이 재시도를 쌓습니다.",
    },
    identity: {
      headline: "계정 연결은 동의 화면 한 번입니다",
      body: "연동 코드를 손으로 옮기게 하거나 이메일이 같기를 바라지 않습니다. Sign in with Slack(OIDC)으로 사용자가 직접 고릅니다 — 구글 캘린더 연동과 같은 모양입니다.",
      points: [
        "봇 설치(`xoxb-`)와는 다른 축입니다. 봇 설치는 워크스페이스에 앱을 넣는 것이고, 이건 「이 슬랙 사람 = 이 Antelope 사용자」를 잇는 것입니다.",
        "state 를 서버에 저장하지 않고 HMAC 으로 서명해 들고 다닙니다. 인스턴스가 재시작해도 진행 중인 동의가 살아야 하기 때문입니다.",
        "답은 스레드를 연 사람에게서만 받습니다. 지식베이스가 사용자별이라, 끼어든 사람의 값을 섞으면 남의 회사 정보가 이 신청서에 들어갑니다.",
      ],
    },
    stream: {
      headline: "그대로 보내면 도배가 됩니다",
      body: "준비 이벤트는 16종이고 `emit` 호출 지점만 20곳입니다. 그래서 둘로 나눕니다 — 흐르는 것은 **메시지 하나를 고쳐** 보여주고, 남을 것만 댓글이 됩니다.",
      keep: "서술자 카드 · 착수 판정 · 만든 서류 · 물어야 할 항목 · 종료",
      drop: "로그(표시줄의 마지막 줄로만) · 단계 전환(숫자로만) · 요약·준비 문서(길다)",
      throttle: "표시줄 편집은 3초 간격. 슬랙 `chat.update` 한도 안쪽입니다.",
    },
    dialogue: {
      headline: "스레드가 열린 채로 답을 받습니다",
      body: "빈 항목이 있으면 스레드 상태가 `asking` 이 되고, 무엇을 묻고 있는지가 DB 에 남습니다 — 서버가 재시작해도 그 뒤에 온 답이 같은 질문에 붙습니다.",
      points: [
        "파일이 먼저입니다. 「사업자등록증이야」 같은 말은 글이 아니라 **첨부의 라벨**이라, 항목 배분에 넣으면 엉뚱한 칸을 채웁니다.",
        "채운 값은 두 곳에 남습니다 — 이번 세션과 지식베이스. 후자가 「다시 묻지 않는다」입니다.",
        "스레드에 올린 서류는 그 실행의 파일 폴더에 들어갑니다. 버리면 첨부가 신청 단계에 닿지 않습니다.",
      ],
    },
    queue: {
      headline: "릴레이는 자기 상한을 따로 겁니다",
      body: "준비 한 건이 실제로 잡는 것은 Studio job 2건, 문서마다 Chromium, 신청까지 가면 Chromium 2개 더입니다. 멘션 세 통이면 그만큼이 곱해집니다.",
      numbers: "동시 실행 2건 · 한 사람은 1건 · 대기 상한 10분",
    },
  },

  // ── 6. 지식베이스 · 근거 ────────────────────────────────────────────
  memory: {
    eyebrow: "8 · 지식베이스 · 근거",
    headline: "한 번 답한 것을 다시 묻지 않습니다",
    sub: "다음 공고가 「상시근로자 수」로 물어도 「현재 직원 수」로 저장한 값을 찾아야 합니다. 조회는 2단계입니다 — label 정확 일치를 먼저 보고, 없으면 임베딩 유사도로 찾습니다.",
    dual: {
      headline: "벡터를 두 벌 갖습니다",
      body: "항목명을 임베딩할 때 값을 섞지 않습니다. 「1999-04-12」 같은 값이 의미를 흐립니다.",
      table: {
        head: ["질의", "대상", "label 만", "label: value"],
        rows: [
          ["상시근로자 수", "현재 직원 수", "0.578", "0.526"],
          ["생년월일", "생년월일", "0.753", "0.627"],
          ["상시근로자 수", "업종명 (오답)", "0.409", "0.385"],
        ],
      },
      columns: [
        { name: "labelEmbedding", body: "항목 매칭용. 라벨만 임베딩합니다" },
        { name: "embedding", body: "서술 검색용. `label: value` 를 함께 임베딩합니다" },
      ],
      threshold:
        "임계값 0.50. 정답 최저 0.578, 오답 최고 0.435 사이에서 골랐습니다. 올리면 못 찾고, 내리면 엉뚱한 값을 자동으로 채워 넣습니다.",
    },
    index: {
      headline: "쿼리 형태가 인덱스를 가릅니다",
      body: "`ORDER BY col <=> $v ASC` 여야 pgvector HNSW 가 붙습니다. `1 - (col <=> $v)` 를 `DESC` 로 정렬하면 의미는 글자 그대로 같은데 인덱스가 안 쓰여 전체 스캔이 됩니다.",
      measured: "17.9ms → 0.100ms",
    },
    curator: {
      headline: "사용자가 기억을 직접 고치지 않습니다",
      body: "무엇을 바꿀지 말로 하면 큐레이터 에이전트가 판단해 반영합니다. 이 컨텍스트를 관리하는 주체가 에이전트라는 사실이 화면에서 드러나야 합니다. 지시가 모호하면 추측하지 않고 되묻습니다 — 「그거 좀 바꿔줘」는 아무것도 하지 않습니다.",
      graph:
        "지식 그래프의 간선 굵기가 실제 코사인 유사도입니다. 지식이 늘수록 그물이 촘촘해집니다.",
    },
    evidence: {
      headline: "「이 값 어디서 나왔어?」에 좌표로 답합니다",
      sub: "재료는 전부 Studio 가 줍니다. parse 스텝의 `coordinates: true` 가 요소마다 정규화 좌표(0~1)를 주므로, 페이지 실제 크기를 몰라도 그릴 수 있습니다.",
      steps: [
        { name: "정규화", body: "공백·기호를 걷어내고 비교 가능한 모양으로" },
        { name: "완전 포함", body: "원문 요소가 값을 통째로 담고 있으면 즉시 채택" },
        { name: "2-gram 포함율", body: "모델이 문장을 다듬은 경우. 임계값 0.6" },
        {
          name: "날짜 재질의",
          body: "`2026-09-15` ↔ 「2026년 9월 15일」은 글자로 절대 안 만납니다",
        },
      ],
      measured:
        "요소 15개 기준 — 모델이 문장을 다듬은 경우 0.727, 무관한 요소 최고 0.176. 날짜 재질의를 넣기 전에는 12개 값 중 마감일 하나만 근거를 못 찾았습니다.",
      honesty:
        "못 찾으면 못 찾았다고 씁니다. 아무 블록이나 칠하면 하이라이트가 근거인 척하는 장식이 됩니다 — 이 제품이 파는 것이 정확히 그 신뢰입니다.",
      citations:
        "instruct 응답의 `additional_values.citations` 는 본문의 `【†1】` 를 parse 요소 id 로 잇습니다. 「모른다」고 말하면서 어디를 봤는지 증명할 수 있습니다.",
    },
  },

  // ── 7. 산출물 ───────────────────────────────────────────────────────
  artifacts: {
    eyebrow: "9 · 산출물",
    headline: "만드는 것과 만들면 안 되는 것",
    sub: "제출 서류를 두 갈래로 가릅니다. 작성 서류만 만들고, 기관에서 발급받는 것은 손대지 않습니다 — 만들면 위조입니다. 이 판정이 게이트웨이의 유일한 `reject` 규칙입니다.",
    formats: [
      {
        ext: "pdf",
        body: "신청 페이지가 어떤 형식을 받는지 알 수 없어 항상 한 벌 더 둡니다",
      },
      { ext: "docx", body: "일반 문서" },
      { ext: "xlsx", body: "내역서·예산표" },
      {
        ext: "hwp / hwpx",
        body: "한글 문서. 지정 서식이 있으면 새로 쓰지 않고 채웁니다",
      },
    ],
    hwp: {
      headline: "지정 서식은 새로 쓰지 않고 채웁니다",
      body: "공고가 준 hwp·hwpx 서식이 있으면 그 파일을 열어 표를 찾고, 행·열과 라벨로 훑어 셀에 값을 넣습니다. 한글 신청 서식은 거의 예외 없이 「항목 | 값」 두 열 표라 이 규칙으로 붙습니다.",
    },
    recall:
      "발급 서류는 만들지 않되, 사용자가 전에 올린 것이 보관함에 있으면 꺼내 씁니다.",
  },

  // ── 8. 폴백 지도 ────────────────────────────────────────────────────
  fallback: {
    eyebrow: "10 · 폴백",
    headline: "한 곳이 실패해도 신청은 계속됩니다",
    sub: "단계 하나가 죽어도 준비는 끝까지 갑니다. 어느 자리에서 무엇으로 갈아타는지, 그때 무엇을 잃는지를 적어 둡니다.",
    rows: [
      {
        when: "Studio Agent ID 없음",
        then: "Document Parse + Solar 직접 호출",
        cost: "분기·근거 좌표를 잃습니다. 화면 `via` 에 그대로 표시됩니다",
      },
      {
        when: "Studio job 실패·시간 초과",
        then: "같은 폴백. 이미 파싱한 원문은 재사용",
        cost: "같은 문서를 두 번 파싱하지 않습니다 — 페이지 과금이라",
      },
      {
        when: "정보 분석 실패",
        then: "요약에서 Solar 가 필드를 도출",
        cost: "필드 정확도가 내려갑니다. 신청은 됩니다",
      },
      {
        when: "항목 병합 실패",
        then: "두 출처를 그냥 이어 붙임",
        cost: "같은 항목을 두 번 묻게 됩니다",
      },
      {
        when: "구조화 출력 계약 위반",
        then: "한 번 되묻고, 안 되면 호출부 폴백",
        cost: "`repaired` 플래그로 사실이 남습니다",
      },
      {
        when: "캡챠 발견",
        then: "Xvfb 수동 모드로 전환, 사람 호출",
        cost: "느려집니다. 신청은 끝까지 갑니다",
      },
      {
        when: "신청 URL 못 찾음",
        then: "「신청 페이지 링크」를 필수 항목으로 사람에게 질문",
        cost: "사람이 한 번 답하면 이어집니다",
      },
      {
        when: "DATABASE_URL 없음",
        then: "앱은 그대로 뜹니다",
        cost: "지식베이스·세션 저장만 빠집니다",
      },
    ],
  },

  cta: {
    headline: "직접 돌려 보세요",
    sub: "공고문 파일이든 링크든 넣으면 위 단계가 그대로 화면에 흐릅니다. 각 카드에 무엇으로 돌았는지(`via`)가 적힙니다. 데모 공고는 로그인 없이 열립니다.",
    primary: { label: "데모 공고 열기", href: "/demo" },
    secondary: { label: "워크스페이스", href: "/app" },
    tertiary: { label: "실시간 상태 · /api/health", href: "/api/health" },
  },
} as const;
