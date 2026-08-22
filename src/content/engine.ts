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
  headline: "공고문 한 장이 제출된 신청서가 되기까지",
  sub: "Antelope 의 엔진은 세 겹입니다. 문서를 구조로 바꾸는 Upstage Studio 워크플로, 모든 모델 호출이 지나가는 단일 게이트웨이, 그리고 실제 신청 사이트를 조작하는 브라우저 하네스. 이 문서는 그 셋이 무엇으로 어떻게 도는지를 코드에 있는 그대로 적습니다.",
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
    { value: "8", label: "준비 파이프라인 단계", sub: "intake → documents, SSE 로 중계" },
    {
      value: "13",
      label: "게이트웨이를 지나는 호출부",
      sub: "runObject · runText 외 직접 호출 없음",
    },
    { value: "11", label: "브라우저 도구", sub: "직렬화된 도구 루프" },
    { value: "34", label: "골든셋 케이스", sub: "순수 함수 · 300ms" },
  ],

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
        body: "예전엔 분류가 앞에 있어서 모델이 한 번 흔들리면 공고가 준 지정 서식 채우기까지 통째로 사라졌습니다 — 모델과 아무 상관이 없는데도.",
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
    stepTypes: [
      {
        type: "document-parse",
        body: "HWP·PDF·이미지·DOCX·PPTX·XLSX 를 표와 서식을 지킨 채 HTML/Markdown 으로. `coordinates: true` 로 요소마다 정규화 좌표(0~1)를 받습니다 — 근거 하이라이트의 재료입니다.",
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
    gotchas: {
      headline: "스펙 문서와 실제가 다른 곳",
      sub: "전부 400 또는 job 실패로 실측했습니다. 증상이 원인과 떨어진 곳에서 나오는 것들이라 특히 적어 둡니다.",
      items: [
        {
          where: "classify 분기 조건",
          doc: 'condition.field: "document_type"',
          real: '"text"',
          symptom:
            "400 — condition must use field 'text' and operator '==' with a leaf label",
        },
        {
          where: "instruct 입력",
          doc: "data.prompt",
          real: "data.input 배열",
          symptom: "job 이 queries are required for instruct 로 실패",
        },
        {
          where: "include 위치",
          doc: "POST 본문",
          real: "GET 쿼리 파라미터",
          symptom: "조용히 무시되고 마지막 스텝만 돌아옴",
        },
        {
          where: "스텝 결과 타입",
          doc: "JSON 객체",
          real: "content[0].text 에 문자열",
          symptom: "JSON 을 낸 스텝도 한 번 파싱해야 함",
        },
        {
          where: "additional_values",
          doc: "객체",
          real: "문자열",
          symptom: "citations 를 못 읽어 근거 하이라이트가 통째로 빔",
        },
        {
          where: "OCR 단어 좌표",
          doc: "boundingBoxes",
          real: "boundingBox",
          symptom:
            "단어가 전부 버려져 화면이 빈 것처럼 보임 — 에이전트가 좌표를 짐작하기 시작",
        },
      ],
    },
    warnings: [
      {
        title: "Agent·Config 는 API 키 소유 계정에 묶입니다",
        body: "키를 바꾸면 이전 에이전트가 안 보입니다. `pnpm studio:provision` 을 다시 돌려 새 계정에 Config 를 만들고 환경변수를 갱신합니다 — 로컬과 배포 양쪽 다.",
      },
      {
        title: "에이전트가 프로젝트에 묶이면 파일 접근이 끊깁니다",
        body: "`GET /v2/agents` 는 200 이고 config 조회도 되는데 job 을 만들면 403 No access to file 입니다. `/v2/files` 로 올린 파일은 프로젝트에 속하지 않기 때문입니다. `PATCH {project_id: null}` 은 200 을 주지만 무시됩니다 — 새 에이전트를 만드는 수밖에 없습니다.",
      },
      {
        title: "Studio UI 로 만든 에이전트를 코드에서 쓰면 안 됩니다",
        body: '`visibility: "readonly"` 로 멀쩡히 보이지만 우리 키로 올린 파일로 job 을 만들면 403 입니다. 오류가 파일 쪽으로 나와 원인을 엉뚱한 데서 찾게 됩니다 — 프로덕션이 이걸로 한 번 죽었습니다.',
      },
    ],
  },

  // ── 3. 게이트웨이 ────────────────────────────────────────────────────
  gateway: {
    eyebrow: "3 · LLM 게이트웨이",
    headline: "모델을 직접 부르는 코드가 없습니다",
    sub: "`generateObject` 를 새로 쓰기 전에 `src/lib/ai/gateway.ts` 를 봅니다. 거기를 안 지나는 호출은 계측·티어링·계약·검증·복구·취소를 전부 잃습니다.",
    file: "src/lib/ai/gateway.ts",
    contract: {
      headline: "필드 계약을 손으로 쓰지 않습니다",
      body: "Upstage 는 `response_format: json_object` 만 받고 zod 스키마를 모델에 넘기지 않습니다. 그래서 계약을 프롬프트에 직접 박아야 하는데, 그 문자열이 열두 곳에 손으로 복제돼 있었습니다 — 스키마를 고치고 문장을 안 고치면 모델은 옛 계약을 따릅니다. `contractOf()` 가 스키마에서 파생하면 그 사고가 구조적으로 불가능해집니다.",
      extra:
        "「json」이라는 낱말도 `systemFor()` 가 반드시 넣습니다. 없으면 Upstage 가 요청 자체를 거부합니다 — 사람이 기억해서 넣던 것을 구조로 바꿉니다.",
      file: "src/lib/ai/contract.ts",
    },
    loose: {
      headline: "스키마는 느슨하게 둡니다",
      body: "`.nullish()` 는 실수가 아니라 정책입니다. LLM 은 값이 없으면 키를 생략하고, 엄격하게 굴면 필드 하나 때문에 배열 전체가 폐기됩니다. 조이는 일은 `normalize` 와 `verify` 가 합니다.",
    },
    verify: {
      headline: "규칙으로 답할 수 있으면 모델에게 묻지 않습니다",
      sub: "스키마는 「문자열인가」까지만 봅니다. 「2026년 9월 중」은 `deadline` 으로 완벽한 문자열이고, 그대로 계획과 기한 역산까지 흘러갑니다. 프롬프트에 규칙을 한 줄 더하기 전에 여기 넣을 수 있는지 먼저 봅니다 — 사이트마다 규칙을 더하면 규칙이 사이트 수만큼 늘고 서로 부딪칩니다.",
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
          body: "「총사업비 (천원)」에 1억을 넣으려면 100000 입니다. 이 한 줄을 위해 브라우저 프롬프트에 케이스 규칙이 붙어 있었습니다.",
        },
        {
          name: "obtainOnly",
          severity: "reject",
          body: "발급 서류를 「작성」으로 분류했는가. 사업자등록증을 우리가 써 주면 값 하나 틀린 것과 급이 다릅니다 — 그래서 유일하게 되묻습니다.",
        },
        {
          name: "uniqueBy",
          severity: "drop",
          body: "같은 것을 두 번 묻는가. 사용자가 가장 싫어하는 실패입니다.",
        },
      ],
    },
    repair: {
      headline: "복구는 한 번뿐입니다",
      body: "두 번째로 같은 계약을 어기는 모델은 세 번째에도 어깁니다. 그때는 결정론적 폴백이 더 쌉니다. 폴백이 있는 호출부는 아예 0 으로 둡니다.",
      severity:
        "`drop` 은 그 값만 버리고 되묻지 않습니다. 값 하나 때문에 왕복을 더 하는 것이 그 값보다 비쌉니다. 버린 사실은 `CallResult.issues` 로 호출부에 그대로 넘어갑니다 — 조용히 지우지 않습니다.",
    },
    tiers: {
      headline: "티어는 표로 둡니다",
      body: '예전에는 `provider === "upstage"` 한 줄로 갈랐습니다. 그래서 트랙을 Azure 로 바꾸는 순간 분류·판정·서술 같은 가벼운 호출이 전부 최상위 모델로 올라갔고, 반대로 `LLM_MODEL=solar-pro3` 를 명시해도 `chatModel("solar-mini")` 가 그걸 덮었습니다. 작은 티어가 없는 프로바이더에서는 기본 모델로 승격합니다 — 없는 배포 이름을 보내면 404 이고, 그건 절감이 아니라 장애입니다.',
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
    headline: "먼저 죽는 자원은 토큰이 아니라 Chromium 입니다",
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
        "응답은 반드시 `clone()` 으로만 읽습니다. 원본 body 를 읽으면 스트리밍이 그 자리에서 깨집니다.",
        "훅이 던지면 계측이 아니라 제품이 죽습니다. 전부 try 안이고, 어떤 경우에도 요청을 방해하지 않습니다.",
        "링버퍼 512개. 영속화하지 않습니다 — 데모 한 번을 프로파일하는 것이 목적이고, 그 이상이 필요해지는 시점에는 이 파일이 아니라 OTel 이 답입니다.",
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
      headline: "임계값을 만지면 `pnpm eval`",
      body: "순수 함수 골든셋 34개가 300ms 에 돕니다 — 근거 매칭 8개, 항목 정리 10개, 의미 검증 16개. CI 에는 붙이지 않습니다.",
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

  // ── 6. 지식베이스 · 근거 ────────────────────────────────────────────
  memory: {
    eyebrow: "6 · 지식베이스 · 근거",
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
        "지식 그래프의 간선은 꾸며낸 것이 아니라 실제 코사인 유사도입니다. 굵기가 곧 유사도이고, 지식이 늘수록 그물이 촘촘해집니다.",
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
    eyebrow: "7 · 산출물",
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
      headline: "WASM 은 번들링할 수 없습니다",
      body: 'hwp 라이브러리에 `.wasm` 이 딸려 있어 Turbopack 이 자기 로더로 감싸려다 빌드를 깹니다. `serverExternalPackages`·`createRequire`·런타임 이름 조합 셋 다 실패했습니다. 답은 번들러가 그 파일을 아예 안 보게 하는 것입니다 — 별도 스크립트가 stdin 으로 입력을 받아 파일로 쓰고, 서버는 `execFile("node", …)` 로 부릅니다.',
      fill: "서식 채우기는 표를 찾아 행·열과 라벨로 훑어 셀에 값을 넣습니다. 한글 신청 서식은 거의 예외 없이 「항목 | 값」 두 열 표라 이 규칙으로 붙습니다.",
    },
    recall:
      "발급 서류는 만들지 않되, 사용자가 전에 올린 것이 보관함에 있으면 꺼내 씁니다.",
  },

  // ── 8. 폴백 지도 ────────────────────────────────────────────────────
  fallback: {
    eyebrow: "8 · 폴백",
    headline: "무엇이 죽으면 무엇으로 갑니까",
    sub: "폴백을 뺏지 않는 것이 게이트웨이의 설계 원칙 중 하나입니다. 체인을 다 소진하면 던지고, 호출부의 기존 `try/catch` 가 문장 하나 안 바뀌고 그대로 동작합니다.",
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
    sub: "공고문 파일이든 링크든 넣으면 위 여덟 단계가 그대로 화면에 흐릅니다. 각 카드에 무엇으로 돌았는지(`via`)가 적힙니다.",
    primary: { label: "워크스페이스 열기", href: "/app" },
    secondary: { label: "실시간 상태 · /api/health", href: "/api/health" },
  },
} as const;
