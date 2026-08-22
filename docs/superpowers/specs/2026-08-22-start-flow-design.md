# 워크스페이스 「목표 시작하기」 플로우 설계

2026-08-22. 입력 하나로 요약 → 조사 → 양식 분석 → 지식베이스 선채움 → 자동 신청까지
한 화면에서 이어지는 플로우. 기존 lab 셋(validation · analysis · notice)을 부품으로 쓴다.

## 목표

컴포저에 파일·링크·문장 중 무엇을 넣든 아래 9단계를 자동으로 탄다.

| #   | 단계                   | 담당                               | 산출물                              |
| --- | ---------------------- | ---------------------------------- | ----------------------------------- |
| 1   | 입력 분류·URL 파고들기 | `solar-mini` + fetch               | 파일 목록, 페이지 본문, 링크 후보   |
| 2   | 요약 + good/bad 판정   | 유효성 검사(Studio) · `solar-mini` | Markdown 요약, 판정                 |
| 3   | 추가 조사(크롤링)      | fetch + `solar-pro4`               | 첨부 파일 추가, 신청 URL, 입력 항목 |
| 4   | 정밀 분석              | 정보 분석(Studio)                  | 분류·검증된 필드 JSON → 입력 항목   |
| 5   | 선채움                 | `memories` (label 일치 → 임베딩)   | 값이 채워진 입력 항목               |
| 6–8 | 화면                   | `StartFlow` 클라이언트             | 빈 항목만 묻고, 없으면 바로 9로     |
| 9   | 자동 신청              | `runBrowserAgent` (Xvfb + xdotool) | 실시간 화면, 캡챠 시 사람에게 양도  |

## 위치

제품 플로우이므로 `(app)` 셸 아래에 둔다. lab 코드는 **읽어서 쓰기만** 한다.

```
src/app/(app)/app/start/
  _lib/types.ts        클라이언트 안전. Stage · Need · StartEvent · ApplyEvent
  _lib/fetch.ts        URL 드릴다운 — 파일이면 내려받고, HTML 이면 본문·링크 추출
  _lib/intake.ts       1단계
  _lib/summarize.ts    2단계 (유효성 검사 → 없으면 Solar 직접 요약) + 판정
  _lib/research.ts     3단계
  _lib/analyze.ts      4단계 (정보 분석 → 없으면 Solar 직접 도출)
  _lib/prefill.ts      5단계
  _lib/pipeline.ts     1~5 를 순서대로 돌리며 이벤트를 흘린다
  _lib/start-flow.tsx  6~9 화면
  run/route.ts         POST multipart → SSE (1~5)
  apply/route.ts       POST JSON → SSE (9)
```

`tabs.tsx` 의 「목표 시작하기」가 `NoticeWorkbench` 대신 `StartFlow` 를 띄운다.
`lab/notice/_lib/run-view.tsx` 의 `LiveScreen` 을 export 해 9단계 화면으로 재사용한다.
`runBrowserAgent` 에 `allowSubmit` 옵션을 추가한다 — 기존 기본값(제출 직전 정지)은 그대로다.

## 데이터

```ts
type IntakeFile = {
  name: string;
  blob: Blob;
  origin: "upload" | "url" | "crawl";
  url?: string;
};

type Need = {
  key: string; // 정규화된 라벨. 중복 제거 키
  label: string; // 화면에 보일 한글 항목명
  kind: "text" | "long" | "date" | "number" | "select" | "checkbox" | "file";
  required: boolean;
  source: "analysis" | "research" | "summary";
  why: string | null; // 왜 필요한지 (원문 근거)
  value: string | null; // 선채움 값
  from: "memory" | null; // 어디서 채웠는지
  memoryLabel?: string; // 기억의 원래 항목명 (다른 말로 저장돼 있었을 때)
};
```

`Need` 병합 규칙: 정보 분석 결과가 우선, research 가 보충. `key` 는 공백·기호를 뺀 라벨이다.
`kind: "file"` 은 브라우저 에이전트가 못 채우므로 「직접 제출」로 따로 보여주고 facts 에서 뺀다.

## 이벤트 (SSE)

```ts
type StartEvent =
  | {
      type: "stage";
      stage: Stage;
      status: "start" | "done" | "error" | "skip";
      detail?: string;
    }
  | { type: "log"; text: string }
  | { type: "files"; files: Array<{ name: string; origin: string; bytes: number }> }
  | { type: "summary"; markdown: string; via: string }
  | { type: "verdict"; verdict: "good" | "bad"; reason: string }
  | {
      type: "needs";
      title: string;
      organization: string | null;
      deadline: string | null;
      applyUrl: string | null;
      needs: Need[];
    }
  | { type: "error"; error: string };

type ApplyEvent =
  | { type: "session"; sessionId: string }
  | { type: "step"; tool: string; detail: string; title: string }
  | { type: "frame"; image: string; title: string }
  | { type: "need:human"; reason: string }
  | { type: "human:done" }
  | { type: "done"; summary: string; steps: number }
  | { type: "error"; error: string };
```

## 단계별 규칙

**1 intake.** 문장 입력은 `solar-mini` 가 `{ intent, urls[] }` 로 푼다(정규식 URL 을
합집합으로 더한다). URL 은 최대 3개를 파고든다. 응답이 문서 MIME(pdf·hwp·docx·…)이면
파일로 저장하고, HTML 이면 본문 텍스트와 `<a href>` 목록을 남긴다. 첨부로 보이는 링크
(확장자·「첨부」「다운로드」 문구)는 `solar-mini` 가 골라 최대 3개까지 내려받는다.

**2 summarize.** 파일마다 유효성 검사(`UPSTAGE_VALIDATION_AGENT_ID`) 을 돌려 Markdown 을 받는다.
에이전트가 없거나 파일이 아닌 입력(페이지 본문·문장)은 Solar 가 같은 섹션 구조로
직접 요약하고 `via` 에 그렇게 표시한다. 판정은 `solar-mini`: 읽을 수 없거나 비었거나
본문을 못 가져왔으면 `bad`, 그 외는 전부 `good`. 파싱 결과가 20자 미만이면 LLM 을
거치지 않고 `bad`. 전부 `bad` 면 여기서 끝난다.

**3 research.** 1단계에서 모은 링크 + 요약 안의 URL 을 후보로 `solar-pro4` 가
`{ attachments[], applyUrl }` 을 고른다. 첨부는 내려받아 파일 목록에 더한다(총 6개,
각 25MB 상한). `applyUrl` 페이지를 한 번 더 읽어 폼 라벨·플레이스홀더를 긁고, 요약과
합쳐 `Need[]`(source: research) 를 뽑는다. 신청 URL 이 끝내 없으면 「신청 페이지 링크」
를 필수 Need 로 넣는다 — 사람이 줘야 한다.

**4 analyze.** 파일 전부를 정보 분석(`UPSTAGE_ANALYSIS_AGENT_ID`) 한 job 에 넣는다.
`fields[]` 를 zod 로 느슨하게 받아 `Need[]`(source: analysis) 로 바꾼다. 파일이 없거나
에이전트가 없으면 Solar 가 요약에서 직접 도출하고 그렇게 표시한다.

**5 prefill.** 로그인 + DB 가 있을 때만. `recallForFields` 로 라벨을 조회해 값을
채운다. 실패는 삼킨다 — 기억 조회가 신청을 막으면 안 된다.

**6–8 화면.** `needs` 이벤트를 받으면 값이 빈 텍스트류 Need 를 센다.
0 이고 `applyUrl` 이 있으면 **곧바로** 9로 간다. 아니면 빈 칸만 폼으로 묻는다.
제출하면 `/lab/notice/save` 로 기억에 남기고 `/app/goals` 로 목표를 만든 뒤 9로 간다.

**9 apply.** `runBrowserAgent({ startUrl: applyUrl, facts, allowSubmit: true, maxSteps: 40 })`.
`LiveScreen` 이 `/lab/notice/live` 로 화면을 받고 `need:human` 에 조작권을 넘긴다.
사람이 「돌려주기」를 누르면 `hold` 가 풀리고 에이전트가 이어서 간다.

## 실패 처리

- 단계 하나의 실패는 `stage:error` 로 알리고 가능한 한 다음 단계로 간다
  (예: 정보 분석 실패 → research Need 만으로 진행).
- 2단계 `bad` 와 1단계 입력 해석 실패만 플로우를 멈춘다.
- 외부 fetch 는 15초 타임아웃, 본문 2MB·파일 25MB 상한.

## 검증

- `pnpm build` (타입체크 포함) · lint · format.
- `/demo/hiring` 링크 입력으로 1→9 를 실제로 돌린다 (유효성 검사·정보 분석 은 Studio 실호출).
- 파일 업로드 경로: 데모 공고 PDF 로 2·4 단계 확인.
- 자연어만 입력: 파일 없이 Solar 직접 요약으로 내려가는지 확인.
