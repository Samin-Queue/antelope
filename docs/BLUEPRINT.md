# 블루프린트 — 에이전트 구성과 핵심 플로우

이 문서는 **무엇을 만들 것인가**의 단일 소스다. 코드가 이 문서와 어긋나면
둘 중 하나가 틀린 것이고, 어느 쪽이 틀렸는지 먼저 정한 뒤 고친다.

작성 시점 현황은 「현재 코드 매핑」 절에 표로 있다. 팀원이 각자 모듈을 만들고
있으므로 **계약(입출력 타입)을 먼저 고정하고 안쪽은 각자 채운다.**

---

## 1. 에이전트 구성

### 우리 에이전트 5축 (Solar Pro4 기반, 우리 코드)

| 축           | 책임                                                                                                                                | 하지 않는 것                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **분석**     | 사용자 요청·첨부를 읽고 «무엇을 하려는 일인가»를 판정한다. 자료를 수집하고, 어느 에이전트를 어떤 순서로 붙일지 계획의 씨앗을 만든다 | 필드를 채우지 않는다. 사이트를 조작하지 않는다           |
| **계획**     | 분석·정규화 결과를 받아 **Markdown 계획서**를 만든다. 언제까지 무엇을, 어디서 신청하는지, 어느 에이전트가 어느 단계를 맡는지        | 데이터를 수집하지 않는다                                 |
| **데이터**   | 필요한 필드를 한곳에 모아 **마스터 테이블**을 만든다. 지식베이스에서 채울 수 있는 것은 채우고, 없는 것만 사용자에게 묻는다          | 추측해서 채우지 않는다 — 모르면 사용자에게 묻는다        |
| **브라우저** | 실제 사이트에서 가입·로그인·입력·첨부·제출을 수행한다                                                                               | 최종 제출을 임의로 누르지 않는다. 캡챠를 우회하지 않는다 |
| **파일**     | 제출용 파일을 만들거나 지정 서식을 채운다 (hwp·docx·xlsx·pdf)                                                                       | 내용을 지어내지 않는다 — 마스터 테이블에 있는 값만 쓴다  |

### Upstage Studio 에이전트 2축 (문서 처리 위임)

| 축              | 책임                                                                                      | Agent ID                     |
| --------------- | ----------------------------------------------------------------------------------------- | ---------------------------- |
| **유효성 검사** | **파일 유효성 검사.** 받은 파일이 요청을 수행할 만한 정보를 담고 있는가를 가볍게 판정한다 | `agt_muzwB24L6KeFdBCP66v3es` |
| **정보 분석**   | **파일 분석·필드 추출·정규화.** 정돈된 필드 목록과 최초 parse 된 Markdown 을 함께 낸다    | `agt_fLbbrRD5NRJPDTuMRb2GLd` |

두 에이전트는 `UPSTAGE_STUDIO_API_KEY` 계정에 묶인다. 키를 바꾸면 에이전트가
안 보인다 — AGENTS.md 「Upstage Studio 에이전트」 절 참고.

---

## 2. 핵심 플로우

```
[1] 사용자 입력 (파일 · 링크 · 자연어)
        │
        ▼
[2] 분석 에이전트 ──위임──▶ 유효성 검사 (유효성)
        │                      parse → OCR → 요약·판정
        ◀──────────────────────┘
        │
[3] 착수 가능한가?
        ├─ 아니오 ──▶ 사용자에게 되묻기 (무엇이 부족한지 명시) ──▶ [1]
        └─ 예
        │
        ▼
[4] 자료 수집 — 웹 검색 · 웹 탐색 · 첨부 파일 · 페이지 자체를 파일로
        │  (정보 분석 이 읽는 포맷으로 변환: JPEG PNG BMP PDF TIFF HEIC
        │   DOCX PPTX XLSX HWP HWPX)
        ▼
[5] 정보 분석 ──▶ 정규화된 필드 목록 + parse 된 Markdown
        │
        ▼
[6] 계획 에이전트 ──▶ 계획서(md)
        └──위임──▶ 데이터 에이전트 ──▶ 마스터 테이블
                        ├─ 지식베이스 조회로 자동 채움
                        └─ 못 채운 것만 사용자에게 질문 (정규화 UI)
        │
        ▼
[7] 필요한 값이 다 찼는가? ──아니오──▶ 사용자 수집으로 되돌아감
        │ 예
        ▼
[8] 브라우저 에이전트 실행 ◀──반복 상호작용──▶ 계획 / 데이터 / 파일 에이전트
        │                                        (계획 수정 · 값 추가 · 파일 생성)
        ├─ 사람이 해야 하는 조작(캡챠 등) ──▶ 라이브 화면을 넘기고 대기
        └─ 최종 제출 직전 정지
```

### 단계별 상세

**[1] 입력.** 파일·링크·자연어 셋 중 무엇이든 받는다. 입력 종류를 사용자가
고르게 하지 않는다.

**[2] 유효성 위임.** 분석 에이전트가 직접 파일을 읽을 수도 있지만 유효성 검사 에
맡긴다 — 파일 수신·OCR·요약이 이미 그쪽에 있고, 가벼운 판정이라 왕복이 싸다.

**[3] 착수 판정.** 여기서 하는 것은 **깊은 분석이 아니다.** 「이 요청을 수행할
만큼의 정보가 첨부에서 나오는가」 하나만 본다. 나오면 사용자를 붙잡지 않고
바로 [4]로 간다. 안 나오면 **무엇이 없어서 못 하는지 지목해서** 되묻는다.

**[4] 자료 수집.** 공고 원문이 첨부 하나로 끝나는 경우는 드물다. 링크를 타고
들어가 PDF·HWP 를 받고, 페이지 자체도 정보 분석 이 읽을 수 있는 파일로 만든다.
이 단계의 목표는 정확도가 아니라 **누락 없음**이다.

**[5] 정규화.** 정보 분석 이 모아 온 자료를 하나의 신청 양식 정의로 수렴시킨다.
산출물이 둘이다 — 필드 목록(구조화)과 parse 된 Markdown(원문 보존).

**[6] 계획 + 데이터.** 계획서는 사람이 읽는 문서이고, 마스터 테이블은 기계가
채우는 표다. 둘 다 세션에 저장된다.

**[7] 수집 루프.** 자동으로 채운 값에는 출처(어느 기억에서 왔는지)를 남긴다.
사용자에게 묻는 값은 **정규화된 것은 정규화 UI 로**, 맥락이 필요한 것은
자연어 textarea 로 받는다.

**[8] 실행.** 브라우저 에이전트가 계획서와 마스터 테이블을 들고 사이트를
돈다. 도중에 필요한 것이 생기면 다른 에이전트를 불러 채운다.

---

## 3. 계약 (모듈 사이에 흐르는 것)

각자 만드는 모듈이 이 모양으로만 주고받으면 안쪽 구현은 자유다.

```ts
/** [1] 입력 */
type Intake =
  | { kind: "file"; files: File[]; note?: string }
  | { kind: "url"; url: string; note?: string }
  | { kind: "text"; text: string };

/** [2] 유효성 검사 */
type ValidityReport = {
  filename: string;
  /** 읽을 수 있었는가 (스캔 실패·암호화·빈 파일) */
  readable: boolean;
  /** 무엇으로 보이는가. 자유 문자열 — 여기서 분류를 확정하지 않는다 */
  looksLike: string;
  /** parse 된 원문 요약 Markdown */
  markdown: string;
  /** 요청 수행에 쓸 만한 정보가 있는가 */
  usable: boolean;
  /** usable=false 일 때 무엇이 없는지 */
  missing: string[];
};

/** [3] 착수 판정 */
type IntakeVerdict =
  | { status: "proceed"; goal: string; category: Category; seeds: string[] }
  | { status: "need-more"; question: string; missing: string[] };

/** [4] 수집물 — 정보 분석 에 넣기 직전 상태 */
type SourceBundle = {
  origin: string; // 어디서 왔는지 (URL 또는 업로드)
  filename: string;
  mime: string; // 정보 분석 이 읽는 포맷으로 이미 변환됨
  bytes: number;
};

/** [5] 정보 분석 */
type NormalizedApplication = {
  applicationType: string;
  applicationTitle: string;
  fields: FieldSpec[];
  /** parse 단계의 원문 Markdown. 근거 하이라이트의 재료 */
  markdown: string;
};

type FieldSpec = {
  key: string;
  label: string;
  /** 정규화 UI 를 고르는 기준 */
  inputType:
    "TEXT" | "TEXTAREA" | "NUMBER" | "SELECT" | "DATE" | "TIME" | "FILE" | "CHECKBOX";
  options?: string[]; // SELECT 일 때
  required: boolean;
  /** 어느 단계에서 쓰이는가 — ELIGIBILITY | APPLICATION | ATTACHMENT */
  stage: string;
  documentName?: string; // 첨부라면 어떤 서류인지
  formName?: string; // 지정 서식이 있으면
  instructions?: string; // 작성 지침
  /** 원문에서 이 필드가 나온 문장. 근거로 되돌아가는 열쇠 */
  source?: string;
};

/** [6] 계획 에이전트 */
type Plan = {
  /** 사람이 읽는 계획서 */
  markdown: string;
  steps: PlanStep[];
};

type PlanStep = {
  id: string;
  title: string;
  /** 이 단계를 누가 하는가 */
  owner: "browser" | "data" | "file" | "user";
  /** 언제까지 */
  dueDate?: string; // YYYY-MM-DD
  /** 어디서 */
  url?: string;
  dependsOn?: string[]; // 다른 step id
};

/** [6] 데이터 에이전트 — 세션의 마스터 테이블 */
type MasterTable = {
  sessionId: string;
  entries: MasterEntry[];
};

type MasterEntry = {
  key: string;
  label: string;
  inputType: FieldSpec["inputType"];
  value: string | null;
  /** 값이 어디서 왔는가 */
  filledBy: "memory" | "user" | "agent" | null;
  /** memory 라면 어느 기억인지 */
  memoryId?: string;
  required: boolean;
  /** 사용자에게 물어야 하는가 */
  needsUser: boolean;
  /** 왜 필요한지 — 질문 화면에 그대로 보여준다 */
  why?: string;
};

/** [8] 파일 에이전트 */
type Artifact = {
  filename: string;
  mime: string;
  /** 어느 서식을 채운 것인지. 새로 만든 것이면 null */
  formName: string | null;
  /** 무엇을 근거로 채웠는지 — 마스터 테이블 key 목록 */
  usedKeys: string[];
};
```

**마스터 테이블은 세션의 단일 진실이다.** 브라우저·파일 에이전트는 여기만
읽는다. 자기가 따로 들고 있는 값으로 폼을 채우면 어느 값이 맞는지 알 수 없다.

---

## 4. 현재 코드 매핑

플로우의 몸통은 **`src/app/(app)/app/start/`** 에 이미 있다. `/app` → `StartSession`
→ `StartFlow` → `POST /app/start/run`(SSE) → `POST /app/start/apply`(SSE) 로 이어진다.

`runStart()` 가 도는 6단계 (`_lib/pipeline.ts`):

| #   | Stage       | 담당            | 파일                                                | 상태                                                                                                              |
| --- | ----------- | --------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | `intake`    | solar-mini      | `_lib/intake.ts` `_lib/fetch.ts`                    | **있음** — 문장에서 링크 추출, 링크가 파일이면 내려받고 페이지면 본문·링크 수집, 첨부 후보를 모델이 골라 다운로드 |
| 2   | `summarize` | **유효성 검사** | `_lib/summarize.ts`                                 | **있음** — 실패 시 `parseDocument` + Solar 로 대체. 경로를 `via` 에 남긴다                                        |
| 3   | `judge`     | solar-mini      | `_lib/summarize.ts`                                 | **있음** — good/bad. bad 면 뒤 단계를 skip 한다                                                                   |
| 4   | `research`  | solar-pro4      | `_lib/research.ts`                                  | **있음** — 신청 URL 을 찾아 실제로 읽고, 폼 라벨에서 입력 항목을 뽑는다                                           |
| 5   | `analyze`   | **정보 분석**   | `_lib/analyze.ts`                                   | **있음** — 파일 여러 개를 한 job 에. 실패 시 Solar 대체                                                           |
| 6   | `prefill`   | 지식베이스      | `_lib/prefill.ts`                                   | **있음** — `recallForFields` 로 선채움                                                                            |
| —   | 병합        | solar-pro4      | `_lib/needs.ts` `_lib/reconcile.ts`                 | **있음** — 같은 항목을 두 번 묻지 않게 모델이 한 번 더 합친다                                                     |
| 7   | 사용자 수집 | —               | `_lib/needs-form.tsx`                               | **부분** — 아래 참고                                                                                              |
| 8   | 실행        | 브라우저        | `start/apply/route.ts` → `lab/notice/_lib/agent.ts` | **있음** — 가상 데스크톱, 라이브 스트리밍, 사람 개입, `allowSubmit`                                               |

### 5축 대비

| 축       | 현재                                               | 빠진 것                                                         |
| -------- | -------------------------------------------------- | --------------------------------------------------------------- |
| 분석     | `intake` + `judge` + `research`                    | —                                                               |
| **계획** | **없음**                                           | 계획서(md)·단계·소유자·기한이 통째로 없다                       |
| 데이터   | `analyze` + `reconcile` + `prefill` + `needs-form` | 마스터 테이블로 **저장되지 않는다**. 클라이언트 state 로만 산다 |
| 브라우저 | `agent.ts` + `desktop.ts` + `ocr.ts`               | 도중에 다른 에이전트를 부르지 못한다 (facts 를 한 번 받고 끝)   |
| **파일** | **없음**                                           | hwp·docx·xlsx·pdf 생성·서식 채우기                              |

### 지금 확인된 구멍

1. **마스터 테이블이 세션에 안 남는다.** `goals` 에 저장하는 것은 title·organization·
   deadline·howToApply 뿐이다(`start-flow.tsx`). 새로고침하면 `needs`·요약·파일이
   전부 사라지고 「모든 세션」에서 다시 열 수 없다.
2. **계획 에이전트가 없다.** 5축 중 하나가 없고, 사람이 읽을 산출물도 없다.
3. **파일 에이전트가 없다.** `kind: "file"` 항목은 사용자에게 올리라고만 하고 끝난다.
4. **브라우저가 고립돼 있다.** `apply` 는 `facts` 를 받고 40스텝을 돌 뿐,
   도중에 값이 모자라도 못 묻고 파일도 못 만든다.
5. **`select` 에 선택지가 없다.** `NeedKind` 에 `select` 는 있는데 `options` 필드가
   없어 실제로는 자유 입력으로 그려진다.
6. **분류 체계가 둘이다.** `start` 플로우는 정보 분석 클래스(`JOB_APPLICATION` 등 7종),
   `lab/notice`·랜딩은 `src/lib/categories.ts`(13종). 둘이 만나지 않는다.

## 5. Studio Config 를 고쳐야 하는 곳

Config 는 불변이라 고칠 때마다 새 Config 가 생긴다. DAG 를 레포에 두고
`pnpm studio:provision` 계열 스크립트로 반영한다.

### 정보 분석 — instruct 스텝 (완료)

`parse → classify(7분기) → extract-* → brief(instruct)`. `brief` 가 신청 개요·
자격 요건·제출 서류·일정·신청 방법·입력 항목·확인 필요 7개 섹션의 Markdown 을
낸다. 인용 마커(`【†n】`)가 붙어 근거 하이라이트의 재료도 된다.

`analyze.ts` 가 `findStep(outputs, BRIEF)` 로 읽어 `Analysis.brief` 로 올리고,
스냅샷의 `brief` 에 저장된다. 계획 에이전트의 입력이 이것이다.

⚠ 남은 문제: extract 가 `required` 를 전부 false 로 내놓는다. brief 가 스스로
「실제 필수 여부는 원문 확인 필요」라고 적을 정도다 — 스키마 description 에
필수 판정 기준을 넣어야 한다.

### 유효성 검사 — 유효성 판정 필드가 없다

지금: `parse → analyze(purpose/keyFacts/actionItems) → summarize(md)`.
`judge` 가 그 Markdown 을 다시 Solar 로 읽어 good/bad 를 매긴다 — 왕복이 한 번 더 있다.

필요: `analyze` 스키마에 아래를 더하면 `judge` 가 모델 호출 없이 분기한다.

```
readable   boolean   읽을 수 있었는가
usable     boolean   요청 수행에 쓸 만한 정보가 있는가
missing    string[]  usable=false 일 때 무엇이 없는지
```

### 분류 클래스

| 정보 분석 classify          | `src/lib/categories.ts`                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `JOB_APPLICATION`           | `JOB_POSTING`                                                                                                    |
| `SCHOLARSHIP_APPLICATION`   | `SCHOLARSHIP`                                                                                                    |
| `HOUSING_APPLICATION`       | `HOUSING_SUBSCRIPTION`                                                                                           |
| `COMPETITION_ENTRY`         | `COMPETITION`                                                                                                    |
| `GRANT_SUPPORT_APPLICATION` | `GOV_SUPPORT_PROGRAM`                                                                                            |
| `PERMIT_APPLICATION`        | `PERMIT_FILING`                                                                                                  |
| —                           | `UNIVERSITY_ADMISSION` `EVENT_ENTRY` `EXAM_CERTIFICATION` `PUBLIC_BENEFIT` `MEMBERSHIP_PROGRAM` `CONTRACT_TERMS` |

지금은 두 세계가 서로를 모르므로 당장 깨지지는 않는다. `start` 플로우가 카테고리로
분기하기 시작하면 그때 통일한다 — 값이 코드의 분기 키다.

## 6. 사람이 개입하는 지점

에이전트 제품에서 「언제 사람에게 넘기는가」는 기능이지 예외가 아니다.

| 지점                        | 왜                                  | 현재                          |
| --------------------------- | ----------------------------------- | ----------------------------- |
| [3] 요청을 못 알아들었을 때 | 추측해서 진행하면 뒤가 전부 틀린다  | 없음                          |
| [7] 지식베이스에 없는 값    | 추측한 값으로 신청서를 내면 안 된다 | `profile-form.tsx`            |
| [8] 캡챠·본인인증           | 대신 처리할 수 없다                 | `desktop.setHold` + 라이브 뷰 |
| [8] 최종 제출               | 되돌릴 수 없다                      | 프롬프트로 정지               |

---

## 7. 다음 작업 순서

앞의 것이 끝나야 뒤가 의미 있는 순서다.

1. ~~마스터 테이블을 세션에 저장~~ — **완료.** `goals.snapshot` 에 요약·brief·
   수집 파일·마스터 테이블·단계 상태. 저장 주체는 **서버**다
2. ~~정보 분석 에 instruct 스텝 추가~~ — **완료.** `brief` 스텝
3. ~~계획 에이전트~~ — **완료.** `_lib/plan.ts`. 마스터 테이블이 확정된 뒤에
   세운다 — 무엇을 사용자에게 물어야 하는지가 계획의 일부다. 단계마다 owner
   (browser·data·file·user)와 마감 역산 기한이 붙는다.

   ⚠ 파일 에이전트가 없어서 「지정양식 사업계획서 작성」을 모델이 `user` 로
   돌린다. 지금은 그게 정직하지만, 파일 에이전트를 만들면 프롬프트에서
   `file` 의 범위를 조여야 한다.

4. **정규화 UI 확장** — 5축 중 빠진 축. 계획서(md)와 단계 목록을 만들어 세션에 저장
5. **정규화 UI 확장** — `select` 에 `options`, `date`·`number`·`time` 을 제대로 그린다
6. **브라우저 ↔ 에이전트 상호작용** — 실행 도중 값이 모자라면 묻고, 파일이 필요하면 만든다
7. ~~파일 에이전트~~ — **완료(PDF 만).** `_lib/file-agent.ts`. 제출 서류를
   **작성**(사업계획서·자기소개서)과 **발급**(등록증·명부·재무제표)으로 가르고,
   작성 쪽만 쓴다 — 발급 서류를 만들면 위조다. 근거 없는 수치는 「확인 필요」
   박스로 남긴다. Markdown → HTML → Chromium PDF, 새 의존성 없음.

   브라우저에 `upload` 도구를 붙여 만든 파일을 실제로 첨부한다.

   ⚠ 남은 것: **hwp·docx·xlsx**. 지정 서식을 채우는 일은 아직 못 한다.
   hwp 는 오픈 라이브러리가 사실상 없어 별도 조사가 필요하다.

8. **유효성 검사 유효성 필드** — `judge` 의 모델 왕복을 없앤다. 급하지 않다
9. **분류 체계 통일** — 카테고리로 분기하기 시작할 때

## 8. 지금 지켜야 할 경계

- 실험 코드는 `src/app/(labs)/lab/<slug>/` 안에만. `src/lib/*` 를 고치지 않는다
- 두 실험에서 쓰이고 검증된 부품만 `src/lib` 으로 승격한다
- 마스터 테이블 밖의 값으로 폼을 채우지 않는다
- 모르면 «모른다»고 쓴다. 추측한 값을 채워 넣지 않는다
