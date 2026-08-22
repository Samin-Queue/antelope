# Antelope

|      |                                         |
| ---- | --------------------------------------- |
| 제품 | **Antelope**                            |
| 레포 | https://github.com/Samin-Queue/antelope |
| 배포 | https://antelope.up.railway.app         |

## 에이전트에게

이 저장소에서 코드를 만지기 전에 이 섹션만은 반드시 지킨다. 근거와 상세는 아래 각 섹션에 있다.

**작업 시작 전**

1. `git pull` — 세 명이 같은 `main` 에 직접 푸시한다. 리베이스로 설정돼 있다.
2. 무엇을 만들지 확정되지 않았으면 `/lab` 실험으로 시작한다. "실험 (lab)" 섹션 참고.

**작업 중 — 어기면 남의 작업이 깨지는 것들**

- 실험 코드는 `src/app/(labs)/lab/<slug>/` 안에만 둔다. **`src/lib/*` 를 고치지 않는다.**
- 랜딩 문구는 `src/content/site.ts` 한 파일에만. 컴포넌트에 문자열을 박지 않는다.
- UI 는 `src/components/ui/*`(shadcn) 를 먼저 찾는다. 이 스타일의 `Button` 은
  `asChild` 가 아니라 base-ui `render` prop 을 쓴다: `<Button render={<Link href="/x" />}>`.
- 제목 세리프는 `.heading-display` 유틸리티로만 쓴다. 현재 사용처는 2곳이고, 늘리기 전에 한 번 더 생각한다.
- DB 접근은 `getDb()` 로. `DATABASE_URL` 없이도 앱이 떠야 한다.
- **"지우면 안 되는 것들" 표를 먼저 읽는다.** 7개 항목 전부 실제로 한 번씩 깨져서 고친 것이다.

**작업 후**

- `pnpm build` — 타입체크가 포함된다. push 전에 훅이 format·lint·typecheck 를 다시 돌린다.
- 환경이 이상하면 `pnpm doctor` 가 무엇이 빠졌는지 알려준다.
- **커밋 이메일은 저장소 `git config` 값을 그대로 쓴다.** 임의로 지정하지 않는다 —
  잘못된 계정으로 귀속되면 히스토리를 다시 써야 한다(실제로 겪었다).

---

## 시작하기

```bash
gh repo clone Samin-Queue/antelope && cd antelope
pnpm install
cp .env.example .env.local     # UPSTAGE_API_KEY 를 채운다 (팀에서 전달받음)
pnpm docker:db                 # 로컬 Postgres 기동
pnpm db:push                   # 스키마 반영
pnpm dev                       # http://localhost:3000
```

`/api/health` 가 200 이고 `llm.provider` 가 보이면 준비 완료다.

### 개발 환경은 두 갈래, 둘 다 유효하다

|                     | 방법                                      | 언제                                                                 |
| ------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| **네이티브** (기본) | `pnpm docker:db` + 호스트 `pnpm dev`      | macOS 에서 가장 빠르다. 파일 감시가 bind mount 를 안 거친다          |
| **devcontainer**    | Cursor/VS Code 에서 `Reopen in Container` | 로컬에 Node·pnpm 을 깔기 싫거나 3명이 완전히 동일한 툴체인을 원할 때 |

어느 쪽을 쓰든 결과물은 같다. 강제하지 않는다.

devcontainer 는 `.devcontainer/compose.yaml` 이 루트 `compose.yaml` 위에 겹치는
얇은 오버라이드다. bind mount·`node_modules` 볼륨·`DATABASE_URL`·`.env.local` 은
전부 루트에서 상속받고, git·gh·claude 는 devcontainer feature 로 이미지에 구워진다.
`devcontainer-lock.json` 이 feature 를 sha256 으로 고정하므로 3명이 같은 버전을 쓴다.
인증(railway/gh/claude)은 named volume 에 남아 리빌드해도 유지되지만 최초 1회는
각자 컨테이너 안에서 로그인해야 한다.

---

## 스택

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 ·
shadcn/ui(base-nova, base-ui) · Drizzle + Postgres(pgvector) · Vercel AI SDK v7 ·
Docker · GitHub Actions · Railway.

```
src/
  app/            라우트. (error|global-error|not-found|loading).tsx 바운더리 포함
    api/chat      LLM 스트리밍 채팅
    api/document  파일 업로드 → Upstage Document Parse
    api/health    프로바이더·모델·DB 상태
    playground/   LLM 연결을 눈으로 확인하는 채팅 UI
  components/
    ui/           shadcn 프리미티브
    sections/     랜딩 섹션
  content/site.ts 랜딩 문구 단일 소스
  lib/
    llm.ts        파트너 API 스위칭 어댑터
    upstage.ts    Document Parse / OCR / Information Extraction
    db/           Drizzle 스키마와 지연 초기화 커넥션
    env.ts        zod 로 검증하는 환경변수
```

---

## 트랙 스위칭

`src/lib/llm.ts` 가 파트너 API 를 OpenAI 호환 인터페이스로 추상화한다.
트랙이 정해지면 **환경변수만** 바꾼다 — 애플리케이션 코드는 건드리지 않는다.

```bash
LLM_PROVIDER=upstage    # api.upstage.ai/v1 · solar-pro4 (solar-pro3/pro2/mini 도 가용)
LLM_PROVIDER=azure      # AZURE_BASE_URL + AZURE_API_KEY
```

개별 값은 `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` 로 언제든 덮어쓴다.

### Upstage

- base `https://api.upstage.ai/v1`, 인증 `Authorization: Bearer`
- 채팅 `solar-pro4`(기본) · `solar-pro3` · `solar-pro2` · `solar-mini`
- 임베딩 `solar-embedding-2-query` / `solar-embedding-2-passage` (1024차원, 8K 컨텍스트)
- 문서 API 는 OpenAI 규격 밖이라 `src/lib/upstage.ts` 가 따로 감싼다
  - `parseDocument()` — PDF·이미지·DOCX·PPTX·XLSX·HWP → 구조화된 HTML/Markdown
  - `ocrDocument()` — 평문만 필요할 때
  - `extractInformation()` — 임의 JSON 스키마로 필드 추출

### Azure — 규격이 세 군데 다르다

- **신형 v1 경로만 지원한다** — `https://<resource>.services.ai.azure.com/openai/v1`.
  레거시 `/openai/deployments/<name>/chat/completions?api-version=...` 은 붙지 않는다.
- **인증이 `api-key` 헤더다** (Bearer 아님). 어댑터가 두 헤더를 모두 보낸다.
- `LLM_MODEL` 에는 모델 id 가 아니라 **배포(deployment) 이름**을 넣는다.

### @rhwp/core(WASM) 도 번들링할 수 없다 — 별도 프로세스로 돌린다

hwp·hwpx 를 쓸 수 있는 오픈 구현이지만, 패키지에 `.wasm` 이 딸려 있어
Turbopack 이 자기 로더로 감싸려다 **빌드를 깬다**:
`Module not found: Can't resolve './rhwp_bg.js'`.

세 가지를 다 시도했고 전부 실패했다.

| 시도                                     | 결과                              |
| ---------------------------------------- | --------------------------------- |
| `serverExternalPackages: ["@rhwp/core"]` | wasm 로더가 먼저 붙어 그대로 실패 |
| `createRequire(...)("@rhwp/core")`       | 리터럴이라 정적 분석에 잡힘       |
| 이름을 런타임 조합해 `import(변수)`      | `Can't resolve <dynamic>`         |

**답은 번들러가 그 파일을 아예 안 보게 하는 것이다.** `scripts/render-hwp.mjs`
(새 문서)와 `scripts/fill-hwp.mjs`(지정 서식 채우기)가 stdin 으로 입력을 받아
파일로 쓰고, 서버는 `execFile("node", …)` 로 부른다. Dockerfile 이
`node_modules/@rhwp` 와 두 스크립트를 따로 복사한다 — 하나라도 빠지면 hwp
생성이 조용히 PDF 로 떨어진다.

서식 채우기는 `getControls()` 로 표를 찾고 `getCellInfo`(행·열) ·
`getTextInCell`(라벨) 로 훑어 `insertTextInCell` 한다. 한글 신청 서식은 거의
예외 없이 「항목 | 값」 두 열 표라 이 규칙으로 붙는다.

### Playwright 는 번들링할 수 없다

두 곳을 지켜야 한다. 어기면 `Module not found: async_hooks` 로 **빌드 전체가 깨진다**.

1. `next.config.ts` 의 `serverExternalPackages: ["playwright", "playwright-core"]`
2. **클라이언트 컴포넌트는 `_lib/types.ts` 에서만 타입을 가져온다.**
   `orchestrator` 를 import 하면 `agent → desktop → node:child_process` 로 이어져
   브라우저 번들에 끌려 들어간다. Playwright 시절에 실제로 한 번 밟았고, 지금은
   의존성이 달라졌을 뿐 같은 규칙이다.

### 임베딩으로 항목을 매칭할 때

항목명을 임베딩할 때 **값을 섞지 않는다.** 실측(solar-embedding-2):

| 질의          | 대상         | label만   | label: value |
| ------------- | ------------ | --------- | ------------ |
| 상시근로자 수 | 현재 직원 수 | **0.578** | 0.526        |
| 생년월일      | 생년월일     | **0.753** | 0.627        |
| 상시근로자 수 | 업종명(오답) | 0.409     | 0.385        |

"1999-04-12" 같은 값이 의미를 흐린다. 그래서 `memories` 는 벡터를 두 벌 갖는다 —
`labelEmbedding`(항목 매칭용)과 `embedding`(서술 검색용).

임계값은 **0.50** 이다. 정답 최저 0.578, 오답 최고 0.435 사이에서 골랐다.
올리면 못 찾고, 내리면 엉뚱한 값을 자동으로 채워 넣는다.

### 브라우저는 두 갈래다 — 캡챠가 가른다

신청을 시작하기 전에 캡챠가 있는지 먼저 본다(`_lib/captcha.ts`). 그 한 번의
판단으로 어느 브라우저가 도는지 갈린다.

|           | 없을 때 — **자동**         | 있을 때 — **수동**   |
| --------- | -------------------------- | -------------------- |
| 무엇으로  | Playwright (headless)      | Xvfb + xdotool       |
| 화면 읽기 | DOM 스냅샷                 | 스크린샷 OCR         |
| 코드      | `_lib/playwright-agent.ts` | `_lib/agent.ts`      |
| 캡챠      | 못 푼다                    | **사람이 직접 푼다** |

DOM 을 직접 읽으면 라벨·현재값·필수 여부·선택지가 정확히 온다. 수동 모드가 겪던
문제가 통째로 사라진다 — 글자 오독, ○/● 를 못 알아봐 라디오를 여섯 번 누르는
진동, 날짜 칸이 `02/02/40315` 로 깨지는 일. 실측으로 같은 4단계 위저드를
34스텝·2분에 끝냈다(수동은 60스텝·3분 30초에 미완).

**탐지는 놓치는 쪽이 훨씬 비싸다.** 놓치면 자동 모드가 캡챠 앞에서 헛돌다 끝나고
사람은 손댈 방법이 없다. 잘못 잡으면 느린 길로 갈 뿐이다. 그래서 넓게 잡는다 —
벤더 URL·DOM 선택자·한국어 문구까지 본다. 숨은 recaptcha v3 배지처럼 **사람이
풀 게 없는 것은 제외**한다(크기 0이면 무시).

캡챠는 제출을 누른 뒤에 뜨기도 한다. 그래서 자동 모드는 **조작할 때마다 다시
확인하고**, 중간에 나타나면 그 자리에서 멈춰 수동 모드로 갈아탄다
(`ApplyEvent` 의 `mode` 이벤트로 화면에도 그대로 보인다).

### 브라우저 조작은 직렬화한다

모델은 도구를 **병렬로** 부른다. `fill` 여덟 개가 같은 순간에 들어가면 React
폼이 배치 업데이트로 서로를 덮어써 값이 남지 않는다 — 실측: 같은 여덟 칸을
세 번씩 다시 채우다 끝났고, 도구 로그에는 여덟 줄이 모두 같은 초로 찍혔다.

두 에이전트 모두 `tools` 정의 **뒤에** 실행을 한 번에 두른다. 도구마다 감싸면
새 도구를 더할 때 잊는다. 실패해도 사슬이 끊기지 않게 `then(ok, err)` 양쪽에
같은 작업을 건다.

### 케이스마다 프롬프트를 붙이지 않는다

사이트 하나에서 틀릴 때마다 규칙을 한 줄씩 더하면, 규칙이 사이트 수만큼 늘고
서로 부딪친다. 실제로 「총사업비 (천원)에 원 단위를 넣었다」·「막히자 이전을
눌렀다」 두 건에 규칙 넉 줄이 붙었다.

**브라우저가 이미 아는 것을 모델에게 추측시키는 것이 원인이다.** HTML5 검증은
「왜 제출이 안 되는가」를 사이트마다 다른 문구가 아니라 표준으로 답한다.

- 스냅샷이 `checkValidity()` 와 `validationMessage` 를 함께 싣는다 →
  `[미충족 이 입력란을 작성하세요]`
- `diagnose` 도구가 그것을 모아 준다 — 못 채운 필수 항목, 빈 파일 칸,
  비활성 버튼. 「막히면 diagnose」 한 줄이 케이스별 규칙 여럿을 대신한다.
- 준비된 파일에 없는 서류가 막고 있으면 사람 몫이라고 그 자리에서 말한다.
  더 밀어봐야 안 되는 일에 스텝을 태우지 않는다.

규칙을 더하기 전에 **브라우저에게 물을 수 있는 것인지** 먼저 본다.

### 브라우저 자동화 — CDP 를 쓰지 않는다 (수동 모드)

`lab/notice` 의 브라우저 에이전트는 Playwright·CDP 없이 돈다. **Xvfb 위에 일반
Chromium 을 띄우고 xdotool 로 마우스·키보드를 넣는다** (`_lib/desktop.ts`).
원격 디버깅 포트가 없으니 `navigator.webdriver` 도 CDP `Runtime.enable` 흔적도
없다 — 캡챠 벤더가 보는 자동화 지문 중 브라우저 쪽은 사라진다.
(IP 평판은 남는다. 데이터센터 IP 는 여전히 의심받는다 — 주거용 프록시가 답이다.)

대가는 **DOM 이 없다는 것**이다. 그래서 읽기는 전부 화면 기준이다:

- 요소 목록 대신 **스크린샷을 OCR** 한 글자 줄(`t1, t2 …`)을 모델에게 준다
  (`_lib/ocr.ts`). 모델이 `t12 를 클릭` 하면 그 글자의 bbox 중심을 실제로 누른다.
- **입력칸은 찾지 않는다.** `<label for>` 글자를 클릭하면 연결된 input 에 포커스가
  가는 HTML 표준 동작을 쓴다. 플레이스홀더는 글자로 찍히니 직접 눌린다.
- **URL 을 모른다.** 전환 여부는 창 제목(`xdotool getwindowname`)과 화면 변화율
  (128×90 래스터 차분, `changeRatio`)로 판정해 모델에게 알린다. 제출을 눌렀는데
  화면이 그대로면 대개 검증 실패다 — 이 피드백이 없으면 모델은 채운 칸을 계속
  다시 채운다. 여백이 많은 페이지는 스크롤해도 0.1 남짓이니 임계값을 올리지 말 것.
- OCR 은 `UPSTAGE_API_KEY` 가 있으면 Upstage, 없으면 **tesseract** 로 떨어진다.
  키 없이도 실험이 돌아야 해서다. tesseract 한국어는 음절 사이에 공백을 끼우므로
  (`다 온 소프트`) 한글 사이 공백은 걷어낸다.
- ⚠ Upstage OCR 응답의 단어 좌표는 **`boundingBox`(단수)** 다. 스펙 문서의
  `boundingBoxes` 와 다르고, 잘못 읽으면 단어가 전부 버려져 **화면이 빈 것처럼**
  보인다 — 에이전트는 그때 좌표를 짐작해 찍기 시작하고 회복하지 못한다(실측).
- 첫 read 전에 `settle` 로 로딩을 기다린다. 빈 화면을 한 번 읽은 모델은 그 뒤
  ref 를 안 믿는다. 프롬프트에도 「페이지를 벗어나지 말 것」「click_at 은 최후
  수단」이 박혀 있다 — 뒤로가기·주소창을 눌러 구글 검색으로 새면 reCAPTCHA 만 만난다.

Chromium 은 **kiosk** 로 띄운다. 주소창이 없어야 페이지 좌표 = 화면 좌표가 된다.
한글 입력은 xdotool 키심 매핑이 불안정해 **클립보드(xclip) + Ctrl+V** 로 넣는다.

사람에게 넘기기: `/lab/notice/live`(SSE 프레임) + `/lab/notice/control`(POST 조작).
X 서버로 직접 들어가므로 **캡챠 iframe 안도 똑같이 눌린다** — CDP 로는 못 하던
일이다. 캡챠 문구가 OCR 에 보이면 에이전트가 `hold` 를 걸고 사람을 기다린다.

실행 환경: `Dockerfile` base 에 `chromium xvfb xdotool xclip imagemagick tesseract-ocr`
이 들어간다. 컨테이너 안에서는 `--no-sandbox` 가 필요하다(페이지에서 감지되지 않는다).
**로컬 arm64 에는 Google Chrome 빌드가 없다** — Debian `chromium` 을 쓴다.

⚠ `pkill -f "Xvfb :1"` 처럼 패턴으로 죽이면 **그 문자열을 가진 자기 셸이 먼저 죽는다.**
`/proc` 을 돌며 cmdline 을 비교하고 `$$` 를 제외할 것.

### Upstage Studio 에이전트 (/v2)

문서 처리 핵심 단계는 v1 REST 직접 호출이 아니라 Upstage Studio 워크플로가 담당한다.

`src/lib/upstage-studio.ts` 가 3단계를 감싼다 — 동기 응답이 아니다.

```
POST /v2/files                 (file, purpose=user_data)  → file_id
POST /v2/responses             (model=<agentId>, input_file) → job_id
GET  /v2/responses/{job_id}    폴링 → completed
```

분류 클래스는 `_lib/categories.ts` 의 `CATEGORIES` 와 **글자 그대로 같아야 한다.**
어느 한쪽만 바꾸면 분류 결과가 어느 분기에도 걸리지 않는다. 값을 영문 대문자로
두는 이유는 그게 코드의 분기 키이기 때문이다 — 한글 라벨을 값으로 쓰면 표기가
조금만 달라져도 매칭이 깨진다.

**Config 는 코드로 만든다.** `src/lib/studio-workflow.ts` 에 DAG 를 두고
`pnpm studio:provision` 으로 반영한다. UI 로 클릭해 만들면 레포에 안 남고
리뷰도 못 한다. Config 는 **불변**이라 고칠 때마다 새 Config 가 생긴다 —
버전 관리와 감사 추적이 공짜로 따라온다.

현재:

| 에이전트                  | Agent ID                     | Config                       |
| ------------------------- | ---------------------------- | ---------------------------- |
| 공고 처리                 | `agt_VUBEVuk2mXQrrTxYnLL93w` | `cfg_EnXdSDnc6VRVdCtEUayNHo` |
| 유효성 검사 (유효성·요약) | `agt_atmMQXMKxDZkjqSkdiVpDq` | `cfg_iCdJf9NLuuNh4sGtTQrVjw` |
| 정보 분석 (필드·준비문서) | `agt_kKEZDyyAzn84oo3AsgpWj9` | `cfg_L9bTyjc9Trws2jq7NMqGot` |

Agent·Config 는 **API 키 소유 계정에 묶인다.** 키를 바꾸면 이전 에이전트가 안 보이므로
`pnpm studio:provision` 을 다시 돌려 새 계정에 Config 를 만들고 `UPSTAGE_AGENT_ID` 를
갱신한다. 로컬과 Railway 양쪽 다 바꿔야 한다.

⚠ **에이전트가 프로젝트(`project_id`)에 묶이면 파일 접근이 끊긴다.**
`GET /v2/agents` 는 200 이고 config 조회도 되는데, job 을 만들면
`403 No access to file` 이 돌아온다. `/v2/files` 로 올린 파일은 프로젝트에
속하지 않기 때문이다. `PATCH {project_id: null}` 은 200 을 주지만 **무시된다** —
`createAgent` 로 새 에이전트를 만들어 Config 를 다시 반영하는 수밖에 없다.
우리가 코드로 만든 에이전트는 `project_id: null` 로 생긴다. UI 에서 프로젝트를
만들면 기존 에이전트가 거기로 끌려 들어가므로, 어느 날 갑자기 깨질 수 있다.

⚠ **Studio UI 로 만든 에이전트를 코드에서 쓰면 안 된다.** `GET /v2/agents` 에는
`visibility: "readonly"` 로 멀쩡히 보이고 config 조회도 200 이지만, 우리 키로 올린
파일로 job 을 만들면 `403 No access to file: file_...` 이 돌아온다. 파일과 에이전트가
다른 프로젝트에 있기 때문이고, 증상이 파일 쪽 오류로 나와 원인을 엉뚱한 데서 찾게 된다.
`pnpm studio:provision` 이 만든 에이전트로 바꾸면 그대로 돈다 — 프로덕션이 이걸로
한 번 죽었다.

```
parse → classify(split) ─┬─ CONTRACT_TERMS        → extract-contract ─┐
                         ├─ HOUSING_SUBSCRIPTION  → extract-housing  ─┤
                         ├─ JOB_POSTING           → extract-job      ─┼─▶ gaps(instruct)
                         └─ (그 외)                → extract-general  ─┘
```

요청마다 에이전트를 새로 만들 필요가 없다. classify 결과로 분기하는 것이
Config 의 존재 이유다.

**스펙 문서와 실제가 다른 곳 두 군데** (둘 다 400/실패로 실측했다):

| 문서                                             | 실제                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| classify 분기 `condition.field: "document_type"` | **`"text"`** — 아니면 400                                         |
| instruct `data.prompt`                           | **`data.input`** 배열 — 아니면 `queries are required` 로 job 실패 |

**`include` 는 GET 쿼리 파라미터다.** `POST /v2/responses` 본문에 넣으면 무시되고
마지막 스텝만 돌아온다. `GET /v2/responses/{id}?include=all` 이어야 4개 스텝이 다 온다.

스텝 결과는 `output[].model` 이 스텝 이름이고 값은 `content[0].text` 에 **문자열로**
들어온다. JSON 을 낸 스텝도 문자열이라 한 번 파싱해야 한다 (`stepOutputs()`).

instruct 응답에는 `additional_values.citations` 로 **원문 좌표가 따라온다.**
"모른다" 고 말하면서 어디를 봤는지 증명할 수 있다 — 근거 하이라이트의 재료다.
`additional_values` 는 **문자열**이라 한 번 파싱해야 하고, 본문의 `【†1】` 이
`citations[].index` 를, `citations[].node_index` 가 parse 요소의 `id` 를 가리킨다.

**에이전트를 만들기만 하면 안 되고 노드 구성을 저장해야 한다.** 저장 전에는
`404 No default config found for agent` 가 돌아온다. Studio 화면에서
Parse → Classify → Extract → Instruct 를 구성하고 저장하면 Config ID 가 생긴다.

`UPSTAGE_AGENT_ID` 가 없으면 v1 직접 호출로 떨어지므로 앱은 계속 동작한다.

### 워크스페이스 「목표 시작하기」 플로우

`/app` 의 첫 탭. 컴포저 입력 하나로 요약 → 조사 → 양식 분석 → 선채움 → 자동
신청까지 잇는다. 코드는 `src/app/(app)/app/start/`, 설계는
`docs/superpowers/specs/2026-08-22-start-flow-design.md`.

```
run/route.ts   1~5단계 SSE:  intake(solar-mini) → summarize(유효성 검사) → judge
               → research(크롤링+solar) → analyze(정보 분석) → prefill(memories)
apply/route.ts 9단계 SSE:    runBrowserAgent(allowSubmit) — lab/notice 재사용
```

- 에이전트 ID 는 `UPSTAGE_VALIDATION_AGENT_ID` / `UPSTAGE_ANALYSIS_AGENT_ID`
  (`pnpm studio:provision:validation` / `:analysis` 로 만든다). **없어도 돈다** —
  파일이 없거나 ID 가 없으면 Solar 직접 호출로 떨어지고 화면 `via` 에 표시된다.
- 입력 항목은 두 출처를 **모델이 병합**한다(`_lib/reconcile.ts`). 정보 분석 의
  "성명" 과 신청 폼의 "이름" 은 같은 항목이다 — 키 병합으로는 못 합쳐서
  같은 걸 두 번 묻게 된다(실측 26개 → 11개). 라벨은 폼 쪽 글자를 남긴다.
- 폼 라벨과 **플레이스홀더를 섞지 않는다.** 플레이스홀더는 예시 값이라 항목으로
  올리면 "010-0000-0000" 을 묻게 된다. `fetch.ts` 가 둘을 갈라 준다.
- 신청 URL 을 못 찾으면 「신청 페이지 링크」를 필수 항목으로 사람에게 묻는다.
- 빈 항목이 0 이고 URL 이 있으면 **사람을 거치지 않고 바로 신청한다**(7단계).
  제출한 값은 `/lab/notice/save` 로 지식베이스에 남아 다음 공고에서 선채움된다.
- lab/notice 는 부품으로 **읽어서 쓴다.** 이번에 lab 쪽에 더한 것은
  `LiveScreen` export 와 `runBrowserAgent` 의 `allowSubmit` 옵션뿐이다.

### 자료 수집 — 사용자가 파일을 안 넣어도 Studio 를 태운다

이 제품이 증명하려는 것은 「링크 하나만 던져도 에이전트가 공고문·모집요강·서식을
스스로 찾아 Studio 에 넣는다」이다. 그래서 수집은 프롬프트 한 줄이 아니라
예산·게이트·중복 제거가 있는 단계다 — `src/app/(app)/app/start/_lib/harvest.ts`.

```
intake   1홉 · INTAKE_BUDGET(6개 / 20MB)   시드 페이지의 첨부만
research 2홉 · HARVEST_BUDGET(24개 / 80MB) 상세 페이지를 열고 그 안의 첨부까지
analyze  모은 것 전부를 Studio 한 job 에
```

- **1홉만 파면 첨부가 0개다.** 사용자가 던진 링크는 게시판 목록인 경우가 흔하다.
  **3홉을 파면 사이트 전체다** — 무관한 공고가 섞이는 순간 classify 가 흔들리고,
  두 공고가 섞인 필드 목록은 사람이 봐도 못 고친다. 목록 → 상세 → 첨부가 실제 깊이다.
- **1단계 예산이 일부러 작다.** 여기서 받은 파일은 요약이 **파일마다 Studio job 을
  하나씩** 돌린다. 24개를 받아 오면 요약이 단계 상한에 걸려 죽고, 요약은 재시도
  목록에 없어서 실행이 통째로 끝난다.
- **바이트가 진짜 제약이다.** Document Parse 는 페이지 과금이고 쪽수는 대체로
  바이트에 비례한다. 개수만 세면 20쪽 공고문 하나와 200KB 서식 열 개가 같아진다.
- **시도 횟수도 예산이다.** 죽은 링크는 받은 게 없어 개수·바이트를 안 줄이는데
  `drill` 은 15초씩 기다린다. `MAX_TRIES` 가 없으면 죽은 링크만으로 상한을 다 쓴다.
- **중복은 바이트(sha256)로 센다.** 같은 공고문이 `/download?fileId=91` 과
  `/upload/공고문.pdf` 로 두 번 링크된 사이트가 흔하다. 이름·URL 비교로는 못 잡고,
  두 번 태우면 Document Parse 를 두 번 낸다.
- **페이지는 호스트를 걸고 문서는 안 건다.** 첨부가 CDN 으로 빠지는 것은 정상이고,
  그 링크가 실린 페이지는 이미 관련성 검사를 통과했다. 반대로 페이지는 스스로
  관련성을 증명하지 못하므로 다른 사이트로 넘어가면 거기서부터 남의 공고다.
- **모델에게 개수 상한을 주지 않는다.** 「3개까지」라고 말하면 열 개가 다 관련
  있어도 세 개만 온다. 총량은 예산이 자른다.
- 상한을 만지면 `pnpm eval` — `evals/harvest.test.ts` 가 게이트를 못박는다.

**단계 상한이 Studio 보다 짧으면 안 된다.** 240초는 파일 한두 개 시절의 값이라,
스무 개를 넣으면 파이프라인이 job 을 먼저 죽이고 화면에는 「시간 초과」만 남는다 —
그때 Solar 폴백으로 떨어져 정확히 보여 주려던 경로가 사라진다. `analyzeBudgetMs()`
하나를 `analyze.ts` 와 `pipeline.ts` 가 **같이** 쓴다.

### 근거 하이라이트

「이 값 어디서 나왔어?」에 좌표로 답한다. 재료는 전부 Studio 가 준다.

- parse 스텝의 `coordinates: true` 가 요소마다 **정규화 좌표(0~1)** 를 준다.
  페이지 실제 크기를 몰라도 그릴 수 있다 — 화면은 A4 비율 상자를 깔고 그 위에 얹는다.
- `src/app/(labs)/lab/notice/_lib/evidence.ts` 가 값 ↔ 원문 요소를 잇는다.
  UI 는 `evidence-view.tsx` 의 `<Cite>` 와 `<EvidencePanel>`.
- 매칭은 정규화 후 **완전 포함 → 문자 2-gram 포함율** 순이다. 임계값 **0.6**.
  실측(요소 15개): 모델이 문장을 다듬은 경우 0.727, 무관한 요소 최고 0.176.
- **날짜만 예외다.** 추출 결과는 `2026-09-15` 인데 원문은 「2026년 9월 15일」이라
  글자로 절대 안 만난다. `queries()` 가 한국어 표기를 만들어 다시 찾는다.
  이걸 넣기 전 12개 값 중 마감일 하나만 근거를 못 찾았다.
- **못 찾으면 못 찾았다고 쓴다.** 아무 블록이나 칠하면 하이라이트가 근거인 척하는
  장식이 된다. 이 제품이 파는 게 정확히 그 신뢰다.
- 응답 크기 때문에 parse 원본의 **단어별 좌표는 버린다**. 요소 단위로 줄이면
  1쪽짜리 공고 기준 5KB 정도다.

링크·자연어 입력은 좌표가 없다(Studio 를 안 탄다). `evidence` 가 비면 패널이
아예 안 뜨고 `<Cite>` 는 평문으로 남는다.

### Upstage 구조화 출력의 함정 두 가지

`generateObject` 로 JSON 을 받을 때 둘 다 밟았다. 우회 코드는
`src/app/(labs)/lab/notice/_lib/extract.ts` 에 있다.

1. **메시지에 `json` 이라는 단어가 없으면 거부한다.**
   `response_format: json_object` 를 쓸 때 Upstage 가 요구한다.
   시스템 프롬프트에 "구조화된 JSON 으로" 같은 표현을 넣어 해결한다.
2. **스키마가 모델에 전달되지 않는다.** zod 스키마를 줘도 Upstage 는 "JSON 으로
   답해라" 만 받는다. 그래서 모델이 `organizer`·`eligibility` 처럼 제 필드명을
   지어내고 검증이 통째로 실패한다. **필드 계약을 프롬프트에 직접 박아야 한다.**

그리고 LLM 은 값이 없으면 키를 **생략**한다. 추출용 스키마는 전부 `.nullish()` 로
느슨하게 받고, 그 뒤 `normalize()` 로 확정 모양을 만든다. 추출 단계에서 엄격하게
굴면 필드 하나 빠졌다고 전체가 실패한다.

---

## 데이터베이스

로컬과 프로덕션이 **같은 이미지**(`ghcr.io/railwayapp-templates/postgres-ssl:18`)를 쓴다.
확장 구성이 같아야 "로컬에선 되는데" 가 안 생긴다.

```bash
pnpm docker:db     # 로컬 Postgres
pnpm db:push       # 스키마 반영 (마이그레이션 파일 없이, 해커톤용)
pnpm db:studio     # Drizzle Studio
```

- 컨테이너 안 `DATABASE_URL` 은 `postgres://postgres:postgres@db:5432/antelope`,
  호스트에서는 `@localhost:5432`.
- **pgvector 0.8.6 이 로컬·프로덕션 모두 활성화되어 있다.** 로컬은
  `docker/initdb/01-extensions.sql` 이 새 볼륨마다 자동 실행한다 — 이 파일이 없으면
  drizzle 의 vector 컬럼이 42704(type "vector" does not exist)로 깨진다.
- 검색이 필요하면 `document_chunks` 테이블이 이미 있다 — `vector(1024)` 컬럼에
  HNSW 코사인 인덱스. 임베딩은 `embed()` 로 만든다
  (저장 문서는 `passage`, 검색어는 `query` — 섞으면 정확도가 떨어진다).
- **스키마를 바꾸면 프로덕션에도 반드시 push 한다.** `pnpm db:push` 는 로컬만
  건드린다. 잊으면 배포는 성공하는데 그 테이블을 쓰는 화면만 런타임에 죽는다
  (실제로 `memories` 추가 후 `/app/knowledge` 가 React #441 로 터졌다).

  ```bash
  railway tcp-proxy create --service Postgres --port 5432 --json
  PW=$(railway variable list --service Postgres --kv | grep '^PGPASSWORD=' | cut -d= -f2-)
  DATABASE_URL="postgresql://postgres:$PW@<host>:<port>/railway" pnpm exec drizzle-kit push --force
  railway tcp-proxy delete <id> --service Postgres --yes
  ```

- 프로덕션 DB 에 직접 붙어야 하면 TCP 프록시를 잠깐 열고 닫는다:
  `railway tcp-proxy create --service Postgres --port 5432` → 작업 →
  `railway tcp-proxy delete <id> --service Postgres --yes`. 열어둔 채 두지 않는다.
- DB 접근은 항상 `getDb()` 로. `DATABASE_URL` 없이도 앱은 떠야 한다
  (랜딩·플레이그라운드는 DB 무관).

---

## 배포

`main` 에 푸시하면 Railway 가 이 레포의 `Dockerfile` 로 빌드해 자동 배포한다.
로컬에서 도는 이미지가 곧 프로덕션 이미지다.

```bash
pnpm docker:up      # app(핫리로드) + postgres 전체 기동
pnpm docker:prod    # 프로덕션 이미지를 로컬에서 그대로 실행
pnpm docker:down    # 정리
railway up          # 수동 배포 (평소엔 불필요)
railway logs --service web
```

Railway 구성: 워크스페이스 `Samin Queue` · 프로젝트 `antelope` ·
서비스 `web`(GitHub 연동) + `Postgres`.

환경변수는 Railway 가 프로덕션의 단일 소스다.

```bash
railway link                                              # 최초 1회
echo "값" | railway variable set KEY --stdin --service web  # 셸 히스토리에 안 남김
railway variable list --kv
railway run pnpm dev                                      # Railway 변수로 로컬 실행
```

---

## Railway 계정 없이 협업하기

Hobby 플랜은 워크스페이스 멤버 초대가 안 된다(추가 워크스페이스 생성·멤버 초대는
Pro 부터). 그래도 세 명이 막히지 않는다.

- **배포** — `main` 푸시 → 자동. Railway 계정 불필요.
- **검증** — `.github/workflows/ci.yml` 이 push·PR 마다
  `format:check` / `lint` / `build` / `docker build` 를 돌린다.
  내 코드가 깨졌는지는 GitHub Actions 탭에서 직접 본다.
- **로컬 DB** — 각자 `pnpm docker:db`. 프로덕션 DB 는 공유하지 않는다.
- **키** — `.env.local` 로 전달받는다. 레포에 커밋하지 않는다.

계정 소유자를 거쳐야 하는 일은 셋뿐이다 — 프로덕션 로그 열람, 환경변수 변경, 롤백.

---

## CI / PR 리뷰

`main` 직접 푸시가 기본이다. 3명이 같은 공간에 있으니 리뷰 대기가 순손실이다.
리스크가 큰 변경만 PR 로 올린다.

**GitHub Actions 는 게이트가 아니다** — 푸시 이후에 돌고, 무료 플랜 프라이빗
레포는 branch protection 이 403 이라 required check 을 걸 수 없다. 그래서 방어선을
세 겹으로 나눈다.

| 층                      | 무엇                                    | 막는 것                             |
| ----------------------- | --------------------------------------- | ----------------------------------- |
| `.githooks/pre-push`    | format · lint · typecheck (10초대)      | 깨진 커밋이 로컬을 떠나는 것        |
| `ci.yml`                | 위 + build + docker build + 스키마 대조 | 훅을 건너뛴 경우의 사후 적발        |
| Railway **Wait for CI** | CI 성공 전 배포 금지                    | 깨진 커밋이 데모 URL 에 올라가는 것 |

pre-push 훅은 `pnpm install` 시 `prepare` 스크립트가 `core.hooksPath` 를 잡아준다.
급하면 `git push --no-verify` 로 건너뛴다.

⚠ `ci.yml` 의 `cancel-in-progress` 는 **PR 에서만** 켠다. main 에서 켜면 연속 푸시로
직전 커밋의 런이 취소되고 그 커밋은 검사를 통째로 빠져나간다 — 빌드가 깨진 채로
`9bf30ea` 가 실제로 그렇게 통과했다.

| 워크플로            | 트리거          | 하는 일                                                                                            |
| ------------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| `ci.yml`            | push(main) · PR | `format:check` → `lint` → `build`(타입체크 포함), 그리고 Railway 가 쓰는 Dockerfile 을 그대로 빌드 |
| `claude-review.yml` | PR              | Claude 가 적대적 검증 리뷰. 첫 줄 `VERDICT: STOP` 이면 빨간 체크                                   |

판정은 `VERDICT: STOP` 일 때뿐 아니라 **리뷰가 아예 안 나왔을 때도 실패**한다.
조용한 통과가 가장 나쁘기 때문이다 — 무판정이면 잡을 re-run 한다.

`claude-review` 는 PR 에서만 돈다 — PR 을 안 쓰면 비용이 0 이다.
`ANTHROPIC_API_KEY` 시크릿이 필요하고, 없으면 잡이 명시적으로 실패한다.
draft·dependabot·문서 전용 PR 은 트리거하지 않고, 같은 PR 의 이전 실행은 취소된다.
diff 600줄 초과면 opus, 아니면 sonnet 으로 자동 라우팅한다.
건너뛰려면 `skip-claude-review` 라벨을 붙이고 실패한 잡을 re-run.

**강제력의 한계** — 무료 플랜 프라이빗 레포는 branch protection API 가 403 이라
required check 을 걸 수 없다. STOP 은 빨간 체크까지고 머지 자체는 안 막힌다.
팀 규칙으로 운영한다: STOP 해소 전 머지 금지.

**Railway "Wait for CI" 는 켜져 있다** (`checkSuites: true`). 안 켜면 Railway 가
푸시 즉시 배포해서 CI 가 실패한 커밋이 데모 URL 에 그대로 올라간다.

CLI 에는 이 설정이 없어 GraphQL 로 켰다:

```
deploymentTriggers(projectId, serviceId, environmentId)   # 트리거 id 조회
deploymentTriggerUpdate(id: <triggerId>, input: { checkSuites: true })
```

토큰은 `~/.railway/config.json` 의 `user.accessToken` 을 쓴다. `User-Agent` 를
`railwayapp-cli/<ver>` 로 보내지 않으면 Cloudflare 가 403 을 돌려준다.

## 인증 · 브랜드

better-auth + Drizzle. **OAuth 만 쓴다** — 도메인이 없어 Resend 무료 플랜은
본인 계정 주소로만 발송되므로(테스트 도메인 제약) 매직링크를 쓸 수 없다.

- 서버: `src/lib/auth.ts` · 클라이언트: `src/lib/auth-client.ts`
- 라우트: `/api/auth/[...all]` · 로그인 화면: `/sign-in`
- 스키마는 better-auth CLI 생성물이다. 플러그인을 추가하면 다시 생성한다:
  `pnpm exec better-auth generate --config src/lib/auth.ts --output <path>`
  → `src/lib/db/auth-schema.ts` 갈아끼우고 `pnpm db:push`
- 자격증명이 없는 프로바이더는 `enabledProviders` 에서 빠져 버튼도 안 그려진다.
  키가 없어도 앱은 뜬다.
- 콜백 URL 은 로컬·프로덕션 둘 다 등록되어 있다:
  `{origin}/api/auth/callback/{google|github}`
- **포트를 바꾸면 리디렉션 URI 를 따로 등록해야 한다.** 구글은 포트까지 정확히
  일치해야 하고 와일드카드가 없다. `3001` 로 띄우려면 콘솔에 URI 를 추가하고
  `BETTER_AUTH_URL=http://localhost:3001` 도 같이 넘긴다 — 안 그러면 3000 으로
  돌아간다.

### 세션은 두 곳에서만 읽는다

**`headers()` 를 조건문 안에 넣지 않는다.** 이게 프로덕션 랜딩을 통째로 얼렸다.

```ts
// ❌ DATABASE_URL 없는 도커 빌드에서 이 줄이 아예 안 돈다 → 동적 API 가 사라지고
//    Next 가 `/` 를 빌드 시점 스냅샷으로 정적 프리렌더한다
const session = hasDb() ? await auth.api.getSession({ headers: await headers() }) : null;

// ✅ 순서를 바꾼다. 이게 `src/lib/session.ts` 의 `currentSession()` 이다
const requestHeaders = await headers();
if (!hasDb()) return null;
return auth.api.getSession({ headers: requestHeaders });
```

증상이 셋으로 흩어져 나와 원인을 엉뚱한 데서 찾게 된다 —
`cache-control: s-maxage=31536000` · `x-nextjs-prerender: 1` 로 굳은 HTML 이

- 로그인해도 헤더에 계속 「로그인」을 보여주고 (세션이 풀린 것처럼 보인다),
- 그 버튼을 누르면 `/sign-in` 이 되돌려 보내 **아무 일도 안 일어나고**,
- 히어로 로그인 다이얼로그가 `enabledProviders: []` 로 굳어
  「GOOGLE_CLIENT_ID 를 확인하세요」를 띄운다 — 키는 멀쩡히 설정돼 있는데도.

세션이 필요한 서버 컴포넌트는 전부 `currentSession()` 을 거친다.

### `/app` 게이트는 `src/proxy.ts` 하나다

Next 16 에서 `middleware.ts` 는 **`proxy.ts`** 로 이름이 바뀌었다. `app` 과 같은 층,
즉 `src/` 바로 아래여야 잡힌다.

|            | 로그인 안 함                  | 로그인함             |
| ---------- | ----------------------------- | -------------------- |
| `/app/*`   | → `/sign-in?next=<원래 경로>` | 통과                 |
| `/sign-in` | 통과                          | → `next` 또는 `/app` |

- **레이아웃 `redirect()` 로는 부족하다.** 그때는 셸이 이미 흘러 나간 뒤라 Next 가
  HTTP 상태를 못 바꾸고 리디렉트를 RSC 페이로드에 `NEXT_REDIRECT` 로 싣는다 —
  응답은 200 이고 브라우저는 하이드레이션 뒤에야 움직여서 로그아웃 화면이 한 번
  번쩍인다(실측). 프록시에서 막으면 문서 요청 자체가 307 이다.
- 쿠키 존재만 보지 않고 **DB 까지 확인한다.** 프록시가 Node.js 런타임이라 가능하다.
  만료·로그아웃 후 남은 쿠키·위조 쿠키가 전부 여기서 걸린다.
- `(app)/layout.tsx` 의 검사는 그대로 둔다. matcher 는 문자열 상수라 경로를 옮기면
  **조용히 커버리지가 빠진다** — 그때 앱이 그냥 열리는 것보다 튕기는 편이 낫다.
- `?next=` 는 사용자가 손대는 값이다. `/` 로 시작하고 `//` 가 아닌 경로만 통과시킨다.

### 구글 캘린더 · Gmail 연동

Google Cloud 프로젝트 `antelope-506205`. 로그인 스코프와 API 스코프를 갈라 둔다.

- 스코프 상수: `src/lib/google-scopes.ts` — **클라이언트 안전**. 서버 헬퍼는
  `src/lib/google.ts` 인데 `next/headers` 를 import 하므로 클라이언트 컴포넌트가
  이걸 import 하면 빌드가 깨진다. 그래서 파일이 둘이다.
- 화면: `/app/settings` (사용자 메뉴 → 「설정 · 연동」)

**스코프는 2개다. 좁게 잡으면 오히려 손해다.**

| 스코프              | 등급   | 왜 이걸로                                                                                                           |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `auth/calendar`     | 민감   | `calendar.events` 로는 `calendarList.list`·`freebusy.query` 가 안 된다. 둘 다 민감 등급이라 넓혀도 검증 부담이 같다 |
| `auth/gmail.modify` | 제한됨 | `readonly` + `send` 를 하나로 덮고 라벨·`users.watch` 까지 된다. `readonly` 가 이미 제한됨이라 등급이 안 내려간다   |

`gmail.send` 만 쓰면 민감 등급으로 내려가지만, 웹훅(`users.watch`)이 `readonly`
이상을 요구해서 어차피 제한됨을 못 피한다.

**동의는 증분으로 받는다.** 로그인은 `email·profile·openid` 만으로도 되고,
캘린더·Gmail 은 `linkSocial` 로 나중에 받는다. 이미 연결된 구글 계정에 다시
걸어도 충돌하지 않는다 — 콜백이 같은 계정이면 토큰을 갱신하고 `scope` 를
**병합**한다. `include_granted_scopes=true` 가 기본이라 토큰 하나가 전부 덮는다.

```ts
// 스코프를 한 배열로 넘기면 동의 화면도 한 번이다
signIn.social({
  provider: "google",
  scopes: GOOGLE_ALL_SCOPES,
  additionalParams: GOOGLE_CONSENT_PARAMS,
}); // 로그인과 동시에
authClient.linkSocial({ provider: "google", scopes, additionalParams }); // 로그인 후
```

`access_type=offline` 없이는 **refresh token 이 안 온다.** `prompt=consent` 도
필요하다 — 구글은 최초 동의 때만 refresh token 을 주기 때문에, 재연동 때 이게
없으면 조용히 빈다. 둘 다 `GOOGLE_CONSENT_PARAMS` 에 있고 **provider 전역이 아니라
호출마다** 붙인다. 전역에 넣으면 스코프가 필요 없는 로그인에도 동의 화면이 뜬다.

**토큰은 `googleAccessToken(...scopes)` 로만 꺼낸다.** 만료 5초 전이면 better-auth
가 갱신해서 DB 에 다시 쓴다. 요청한 스코프가 아직 동의 전이면 `null` 이라,
없는 권한으로 API 를 때려 403 을 받는 대신 연동 화면으로 보낼 수 있다.

⚠ `getAccessToken` 의 `accountId` 는 `account` 테이블의 **행 id** 다. 구글 sub 인
`account.accountId` 를 넣으면 1.7.x 는 `ACCOUNT_NOT_FOUND` 로 400 을 돌려준다.
`listUserAccounts()` 가 주는 `id` 를 쓴다 (같은 응답의 `scopes` 로 연동 상태도 그린다).

**Testing 모드의 두 가지 제약** — 등록된 test user 만 동의할 수 있고(최대 100명),
발급된 refresh token 은 **7일 뒤 만료된다.** 단기 사용에는 무해하지만 그 뒤엔
재연동이 필요하다. `gmail.modify` 가 제한됨 등급이라 Publish 하려면 CASA 심사를
받아야 한다.

### 브랜딩 심사 — `*.up.railway.app` 으로는 통과할 수 없다

Testing 모드로 데모하는 동안은 상관없다. **앱을 Publish 하려면 브랜딩 심사가
먼저 통과해야 하고**(스코프 심사는 그다음이다), 여기서 도메인 때문에 막힌다.

반려 사유 세 가지 중 **홈페이지 소유 확인만 코드로 못 푼다.**

| 반려 사유                | 상태                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| 홈페이지 소유 미확인     | ❌ 커스텀 도메인을 사야 한다                                       |
| 앱 목적 설명 없음        | ✅ `sections/about.tsx` — 목적과 스코프 용도를 한/영으로 낸다      |
| 동의 화면 앱 이름 불일치 | ✅ `Antelope` 를 조사 없는 맨 텍스트로 About `<h2>` 와 푸터에 둔다 |

⚠ **Search Console 「URL 접두어」 속성은 인정되지 않는다.** OAuth 심사는
**「도메인」 속성**만 본다 — 그리고 도메인 속성은 **DNS TXT 검증만** 지원한다.
`google-site-verification` 메타 태그·HTML 파일 업로드는 URL 접두어 전용이다.
메타 태그로 「확인됨」을 받아도 심사는 같은 오류를 그대로 돌려준다.
검증한 구글 계정이 GCP 프로젝트의 **소유자(Owner)** 여야 한다는 조건도 붙는다.
→ https://support.google.com/cloud/answer/13804266

`up.railway.app` 은 **Public Suffix List 등재 도메인**이다(`public_suffix_list.dat`
15370행, Railway 가 직접 제출). 그래서 `antelope.up.railway.app` 은 형식상
top private domain 이라 「승인된 도메인」 필드에는 들어간다 — 그런데 그 도메인의
DNS 는 Railway 소유이고, Railway 는 "**임의 DNS 레코드 추가는 의도적으로 막는다**"
고 명시한다. TXT 를 꽂을 수단이 없으니 도메인 속성 검증이 영원히 불가능하다.

거기에 Google 이 이 상황을 대놓고 금지한다 — 「서브도메인 소유를 확인할 수 없는
서드파티 플랫폼에 홈페이지·개인정보처리방침을 두지 말 것」. `github.io` 에 대해
실제 거절 통보가 나온 사례가 있다. → https://support.google.com/cloud/answer/13807376

**푸는 방법은 하나다.** 도메인을 사서 Railway 커스텀 도메인으로 붙이고,
Search Console 에서 **도메인 속성 + DNS TXT** 로 검증한 뒤,
승인된 도메인·홈페이지·개인정보처리방침 URL 을 전부 새 도메인으로 바꾼다.
개인정보처리방침도 **홈페이지와 같은 도메인**에 있어야 한다.
코드에서 고칠 곳은 `site.url` 한 곳과 `BETTER_AUTH_URL`, 구글 콜백 URI 다.

**앱 목적 설명은 개인정보처리방침에 있는 것으로 부족하다.** 심사 지침이
「홈페이지를 고쳐 앱의 목적**과 요청한 구글 사용자 데이터를 어떻게 쓰는지**를
설명하라」고 못박는다. 그래서 `about` 이 스코프마다 용도를 한 줄씩 적는다.

**앱 이름은 「보이는 본문 텍스트」여야 한다.** 로고 `alt` 속성만으로는 안 되고,
`<title>`·`og:site_name`·JSON-LD 가 판정에 쓰인다는 근거는 어느 문서에도 없다
(보조로 넣되 의존하지 않는다). 히어로의 「Antelope로」는 조사가 붙어 토큰이
`Antelope로` 라 정확히 일치하지 않는다 — 이래서 About `<h2>` 가 이름만 낸다.

심사 크롤러가 JS 를 돌린다는 보장이 없다. About 은 **서버 렌더링**으로 둔다.

자동 검증을 통과해도 **7일 안에 Publish branding 을 누르지 않으면 만료**된다.

**웹훅은 스코프 밖에 일이 더 있다.** Gmail 은 Pub/Sub 토픽을 만들고
`gmail-api-push@system.gserviceaccount.com` 에 Publisher 를 준 뒤 push 구독을
공개 HTTPS 로 걸어야 한다. `users.watch` 는 **7일마다 갱신**해야 하고, 알림에는
`emailAddress`·`historyId` 만 와서 `users.history.list` 로 따로 조회한다.
캘린더는 채널 자동 갱신이 없어 만료 전에 다시 만들어야 하는데, 그냥
`events.list` 를 `syncToken` 으로 증분 폴링하는 편이 단순하다.

브랜드:

- 컬러 **#713BFF** = `--brand`(oklch). `--primary` 가 이걸 참조하므로 버튼·링은
  자동으로 브랜드색이다. 다크 테마는 대비 확보를 위해 한 단계 밝은 값을 쓴다.
- 로고는 `public/brand/`. `-on-light` 는 검정(밝은 배경용), `-on-dark` 는
  흰색(어두운 배경용)이고 `src/components/brand.tsx` 가 CSS 로 전환한다.
- 파비콘·앱 아이콘은 `src/app/icon.png`·`apple-icon.png` 에서 Next 가 생성한다.
- 테마는 next-themes(`class` 전략). 헤더의 `ThemeToggle` 로 전환한다.
- 타이포는 두 벌이다. 본문·UI 는 **Pretendard**(`font-sans`), 랜딩 최상위 제목만
  **Diphylleia**(`font-serif`) — 로고와 같은 세리프 계열이라 붙는다.
  · 적용 범위는 히어로 h1 과 랜딩 섹션 h2 까지다. 내비·버튼·본문·앱 화면에는 쓰지 않는다.
  · Diphylleia 는 **weight 400 하나뿐**이라 반드시 `font-normal` 과 함께 쓴다.
  `font-semibold` 를 얹으면 브라우저가 가짜 볼드를 합성해 획이 뭉개진다.

## 기업 지식베이스

이 제품의 해자다. 신청 한 번에 입력한 정보를 버리지 않고 다음 공고에서 재사용한다.

- `memories` 테이블 · `_lib/memory.ts` · 화면은 `/app` 의 「지식 베이스」 탭
- **사용자는 기억을 직접 고치지 않는다.** 무엇을 바꿀지 말로 하면 큐레이터
  에이전트(`knowledge/_lib/curator.ts`)가 판단해 반영한다. 이 컨텍스트를
  관리하는 주체가 에이전트라는 사실이 화면에서 드러나야 한다.
  지시가 모호하면 추측하지 않고 되묻는다 — "그거 좀 바꿔줘" 는 아무것도 하지 않는다.
- 조회는 2단계다. **label 정확 일치 → 임베딩 유사도**. 그래서 다음 공고가
  "상시근로자 수" 로 물어도 "현재 직원 수" 로 저장한 값을 찾는다.
- 벡터는 두 벌이다 — `labelEmbedding`(항목 매칭), `embedding`(서술 검색).
- 지식 그래프의 간선은 **꾸며낸 것이 아니라 실제 코사인 유사도**다
  (`graphEdges`). 굵기가 곧 유사도이고, 지식이 늘수록 그물이 촘촘해진다.
- 힘 기반 배치는 d3 없이 직접 돌린다. 노드가 수십 개라 그 정도로 충분하다.

## 실험 (lab)

무엇을 만들지 확정되지 않았을 때 아이디어를 병렬로 찔러본다. **레포를 나누지 않는다** — 인프라
재세팅 비용이 실험 비용보다 크고, 브랜치로 나누면 같은 배포 URL 에서 나란히
비교할 수가 없다.

```
src/app/(labs)/lab/<slug>/page.tsx   실험 하나 = 폴더 하나
src/content/labs.ts                  레지스트리 (제목·가설·상태·담당)
/lab                                 실험 인덱스
```

- **버릴 때는 폴더를 지우고 레지스트리에서 뺀다.** 그게 전부여야 한다.
- 실험 코드는 자기 폴더 안에만 둔다. `src/lib/*` 를 고치지 않는다 — 고치면
  버릴 때 다른 실험이 같이 깨진다.
- 공용 부품(`components/ui`, `lib/llm`, `lib/upstage`, `lib/db`)은 **읽어서 쓰기만** 한다.
- DB 가 필요하면 새 테이블 대신 `documents.raw`(jsonb) 를 쓴다. 스키마를 늘리지 않는다.
- 어떤 부품이 두 실험에서 쓰이고 검증되면 그때 `src/lib` 으로 승격한다.
- 세 명이 각자 다른 slug 를 맡으면 충돌이 거의 없다.
- 승자가 정해지면 그 lab 을 루트 라우트로 승격하고 나머지 폴더를 지운다.
- `(labs)` 레이아웃에 점선 배너가 붙어 프로덕션 화면과 눈으로 구분된다 —
  데모 중에 실수로 실험을 보여주는 일을 막는다.

## LLM 계층 — `src/lib/ai/`

**모델을 직접 부르지 않는다.** `generateObject`·`generateText` 를 새로 쓰기
전에 `src/lib/ai/gateway.ts` 를 본다. 거기 안 통과하는 호출은 계측·티어링·
계약·검증·복구·취소를 전부 잃는다.

```
src/lib/ai/
  gateway.ts   runObject / runText — 호출부가 보는 전부
  contract.ts  zod 스키마 → 프롬프트 계약 문장. 「json」 낱말을 구조적으로 넣는다
  verify.ts    의미 검증 규칙 (날짜·화이트리스트·단위·플레이스홀더·중복·위조)
  lanes.ts     동시성 상한. studio 3 / interactive 4 / batch 2 / browser 2
  meter.ts     계측 fetch + AsyncLocalStorage 귀속
  ledger.ts    토큰·지연·실패 원장. /api/health 가 최근 10분을 낸다
  window.ts    도구 루프의 컨텍스트 창 (prepareStep)
```

**계약을 손으로 쓰지 않는다.** `runObject` 에 `schema` 를 주면 프롬프트의
필드 계약이 거기서 파생된다. 스키마를 고치고 문장을 안 고치는 사고가
구조적으로 불가능해진다.

**스키마는 느슨하게 둔다.** `.nullish()` 는 실수가 아니라 정책이다 — LLM 은
값이 없으면 키를 생략하고, 엄격하게 굴면 필드 하나 때문에 배열 전체가 폐기된다.
조이는 일은 `normalize` 와 `verify` 가 한다.

**규칙으로 답할 수 있으면 모델에게 묻지 않는다.** 브라우저의 `checkValidity()`
에 물어 케이스별 프롬프트를 없앤 것과 같다. 프롬프트에 규칙을 한 줄 더하기
전에 `verify.ts` 에 넣을 수 있는지 먼저 본다 — 사이트마다 규칙을 더하면 규칙이
사이트 수만큼 늘고 서로 부딪친다.

**병렬화에는 반드시 레인을 건다.** 이 컨테이너에서 먼저 죽는 자원은 토큰이
아니라 Chromium 이다. `probeCaptcha`·`runPlaywrightAgent`·`renderPdf` 가 같은
레인(2)을 쓰고, Xvfb 수동 세션만 자기 상한(`MAX_SESSIONS = 2`)으로 즉시
거절한다 — 15분 사는 세션을 레인에 넣으면 다음 신청이 무한 대기가 된다.

**준비는 탭을 닫아도 끝까지 간다.** 그래서 `/run` 은 클라이언트가 떠나도
중단하지 않는다 — 대신 요약 직후 `goals` 행을 만들고 단계마다 덮어써, 사용자가
「지난 목표」에서 이어 받는다. 취소의 유일한 출처는 단계 상한(240초)이다.

**킬스위치가 있다.** `AI_PREPARE_STEP`·`AI_TIER_ROUTING`·`AI_REPAIR`·
`AI_VERIFY`·`AI_SUBMIT_GATE`. `env` 는 import 시점에 한 번 parse 되므로 런타임
토글은 안 되지만, 배포 변수 하나로 5분 안에 되돌린다.

**임계값을 만지면 `pnpm eval`.** 순수 함수 34개가 300ms 에 돈다. CI 에는
안 붙인다 — 게이트를 늘리는 것이 순손실이라는 아래 판단과 같은 이유다.

## 규칙

- 랜딩 문구는 전부 `src/content/site.ts` 에. 컴포넌트에 문자열을 박지 않는다.
- UI 프리미티브는 `src/components/ui/*`. 직접 만들기 전에
  `pnpm dlx shadcn@latest add <name>` 부터.
- 이 스타일의 `Button` 은 `asChild` 가 아니라 base-ui `render` prop 을 쓴다:
  `<Button render={<Link href="/x" />}>`. `SidebarMenuButton` 도 같다.
- 화면은 셸이 셋이다. **마케팅**(랜딩, 셸 없음) · **앱**(`(app)`, 사이드바) ·
  **실험**(`(labs)`, 점선 배너). 새 화면은 어디에 속하는지부터 정한다.
- 저장하면 Prettier 가 포맷한다. 손으로 정렬하지 않는다 — Tailwind 클래스 순서와
  import 순서까지 플러그인이 맞춘다. CI 가 `format:check` 로 막는다.
- 커밋 전 `pnpm build` — 타입체크가 빌드에 포함되어 있다.
- **작업 시작 전에 `git pull`** 한다. 세 명이 같은 `main` 에 직접 푸시하므로
  갈라진 채로 오래 두면 충돌이 커진다. `pnpm install` 이 `pull.rebase=true` 와
  `rebase.autoStash=true` 를 잡아두므로 `git pull` 만 해도 리베이스되고,
  작업 중인 변경은 자동으로 넣었다 빠진다.
- 원격과 갈라진 상태로는 pre-push 훅이 푸시를 막는다. 여기서 막지 않으면
  non-fast-forward 로 실패하고, 그때 force push 로 남의 커밋을 날리는 사고가 난다.
- **`git push --force` 를 쓰지 않는다.** 정말 필요하면 `--force-with-lease` 를 쓰고
  팀에 먼저 알린다.

## 지우면 안 되는 것들

전부 한 번씩 실제로 깨져서 고친 것들이다.

| 위치                           | 무엇                                                            | 지우면                                                                                                                                                                  |
| ------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                   | `pnpm config set node-linker hoisted`                           | pnpm 심볼릭 링크 레이아웃을 Next standalone 트레이싱이 못 따라가 `@swc/helpers` 누락 → 런타임 MODULE_NOT_FOUND                                                          |
| `Dockerfile`                   | BuildKit 지시자(`# syntax`, `--mount=type=cache`) **없는** 상태 | Railway Metal 빌더가 빈 로그로 FAILED. 다시 넣지 말 것                                                                                                                  |
| Railway 변수                   | `PORT=3000`                                                     | Railway 기본값 8080 과 도메인 타깃 포트(3000)가 어긋나 502                                                                                                              |
| `public/.gitkeep`              | 빈 디렉터리 유지                                                | git 이 빈 디렉터리를 추적하지 않아 fresh clone 에서 `COPY /app/public` 이 not found                                                                                     |
| `package.json`                 | `studio:provision` 의 `--env-file=.env.local`                   | `@/lib/env` 가 import 시점에 `process.env` 를 굳혀서, 스크립트 안에서 `dotenv` 를 부르면 이미 늦다 → `Missing required environment variable: UPSTAGE_API_KEY`           |
| `drizzle.config.ts`            | `config({ path: ".env.local" })`                                | dotenv 기본값은 `.env` 인데 Next 는 `.env.local` 을 쓴다 → `db:push` 가 DATABASE_URL 을 못 찾음                                                                         |
| `.devcontainer/post-create.sh` | `--config.confirmModulesPurge=false`                            | pnpm 이 "reinstall from scratch? (Y/n)" 를 띄우고 비대화형에서 응답이 안 돼 postCreate 무한 대기                                                                        |
| `src/lib/llm.ts`               | `fetch: meteredFetch` · `includeUsage: true`                    | 원장이 통째로 빈다. 호출 21곳이 전부 이 한 자리를 지나므로 여기 말고는 붙일 데가 없다                                                                                   |
| `playwright-agent.ts`          | `guard()` 의 `stop.abort()`                                     | AI SDK 가 도구 예외를 `tool-error` 로 삼켜 캡챠 수동 전환이 **한 번도 안 열린다**. throw 만으로는 루프가 안 멈춘다                                                      |
| `apply/route.ts`               | `emit(browser done)` 이 `controller.close()` **앞**             | 그 이벤트가 삼켜져 성공한 신청이 「연결이 끊겨 중단됐다」로 끝난다                                                                                                      |
| `memory.ts`                    | `ORDER BY <=> ASC` 형태 (`1 - distance DESC` 금지)              | pgvector HNSW 가 안 붙어 전체 스캔이 된다 — 실측 17.9ms → 0.100ms                                                                                                       |
| `.devcontainer/compose.yaml`   | `NODE_ENV: ""`                                                  | Dockerfile dev 타깃의 `NODE_ENV=development` 상태로 `pnpm build` 하면 React 가 dev/prod 로 갈려 프리렌더 깨짐                                                           |
| `src/lib/session.ts`           | `headers()` 를 `hasDb()` **밖에서** 먼저 부르는 순서            | 도커 빌드엔 `DATABASE_URL` 이 없어 호출이 통째로 안 돌고, 동적 API 가 사라진 `/` 를 Next 가 정적 프리렌더한다 → 랜딩이 「로그아웃 + 프로바이더 없음」 스냅샷으로 굳는다 |
| `src/proxy.ts`                 | `/app`·`/sign-in` 세션 게이트                                   | 로그인 없이 `/app` 이 열린다. 레이아웃 `redirect()` 만으로는 셸이 이미 흘러 나간 뒤라 200 + `NEXT_REDIRECT` 가 되어 로그아웃 화면이 한 번 번쩍인다                      |

## 이름 규칙

- **제품 = Antelope** — 레포, Railway 프로젝트, `site.name`, `package.json`,
  compose 프로젝트명, Postgres DB 이름, 도커 이미지 태그.
- **팀 = Samin Queue** — GitHub org(`Samin-Queue`), Railway 워크스페이스.

제품명을 또 바꾸면 인프라 식별자(compose 프로젝트명·DB 이름·도커 태그)는 그대로
두는 편이 낫다 — 바꾸면 로컬 볼륨과 DB 가 새로 만들어져 팀원 환경이 초기화된다.
GitHub 레포명은 `gh repo rename` 후 `git remote set-url` 만 하면 되고, 옛 URL 은
GitHub 이 리다이렉트한다. Railway 프로젝트명은 CLI 에 명령이 없어 대시보드나
GraphQL `projectUpdate` 로 바꾼다.

## 명령

```bash
pnpm dev            # 개발 서버
pnpm build          # 타입체크 + 프로덕션 빌드
pnpm typecheck      # 타입만
pnpm eval           # 순수 함수 골든셋. 임계값을 만지면 이걸 돌린다
pnpm lint
pnpm format         # Prettier 일괄 적용
pnpm format:check   # CI 와 동일한 검사

pnpm docker:db      # 로컬 Postgres 만
pnpm docker:up      # app + postgres
pnpm docker:prod    # 프로덕션 이미지 실행
pnpm docker:down

pnpm db:push        # 스키마 반영
pnpm db:studio      # Drizzle Studio
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
