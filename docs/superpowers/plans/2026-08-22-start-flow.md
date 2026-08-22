# 「목표 시작하기」 플로우 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 컴포저 입력 하나로 요약 → 조사 → 양식 분석 → 선채움 → 자동 신청까지 한 화면에서 잇는다.

**Architecture:** 서버는 `start/run`(1~~5단계, SSE)과 `start/apply`(9단계, SSE) 두 라우트. 단계 모듈은 `_lib/` 에 하나씩. 클라이언트 `StartFlow` 가 두 스트림을 순서대로 읽고 6~~8단계를 결정한다. 유효성 검사·정보 분석 은 Studio 에이전트, 브라우저는 기존 `runBrowserAgent`.

**Tech Stack:** Next.js 16 App Router · Vercel AI SDK v7 (`generateObject`) · Upstage Studio v2 · zod · react-markdown · Xvfb/xdotool 에이전트.

**Spec:** `docs/superpowers/specs/2026-08-22-start-flow-design.md`

## Global Constraints

- `src/lib/*` 를 고치지 않는다. lab 코드는 읽어서 쓰기만 한다 (예외: `lab/notice` 는 `LiveScreen` export 와 `allowSubmit` 옵션 추가 — 이 lab 의 소유자가 이 작업이다).
- 클라이언트 컴포넌트는 `_lib/types.ts` 에서만 타입을 가져온다 (`node:child_process` 번들 유입 금지).
- `DATABASE_URL`·`UPSTAGE_*_AGENT_ID` 가 없어도 플로우가 돌아야 한다 (폴백·건너뛰기).
- 외부 fetch: 15초 타임아웃, HTML 2MB, 파일 25MB, 파일 총 6개.
- 커밋은 사용자가 요청할 때만.

---

### Task 1: 타입과 URL 드릴다운

**Files:** Create `src/app/(app)/app/start/_lib/types.ts`, `_lib/fetch.ts`

**Produces:**

- `types.ts`: `Stage`, `STAGE_LABEL`, `Need`, `NeedKind`, `StartEvent`, `ApplyEvent`, `FileInfo`
- `fetch.ts`: `drill(url): Promise<Drilled>` where `Drilled = { kind: "file"; file: IntakeFile } | { kind: "page"; url; title; text; links: Link[] }`; `htmlToText`, `extractLinks(html, base): Link[]`, `looksLikeDocumentUrl(url)`, `IntakeFile`, `Link = { url; text; isDocument }`, `formHints(html): string[]` (label/placeholder 글자)

- [ ] 작성 후 `pnpm typecheck`

### Task 2: 1단계 intake

**Files:** Create `_lib/intake.ts`

**Produces:** `intake(input: IntakeInput, ctx: Ctx): Promise<Intake>`; `IntakeInput = { text?: string; url?: string; file?: File }`; `Intake = { intent: string; files: IntakeFile[]; pages: Page[]; links: Link[] }`; `Ctx = { log: (text) => void }`.

- 문장 → `solar-mini` `{ intent, urls }` (+정규식 합집합). URL 최대 3개 drill. 페이지 첨부 링크는 `solar-mini` 가 최대 3개 선택 → 다운로드.

### Task 3: 2단계 summarize + 판정

**Files:** Create `_lib/summarize.ts`

**Produces:** `summarize(intake, ctx): Promise<Summary>`; `Summary = { markdown: string; via: string; parts: Array<{ name; markdown; via }> }`; `judge(summary): Promise<{ verdict: "good"|"bad"; reason }>`.

- 파일: 유효성 검사 → markdown (`summarize` 스텝). 없으면 `parseDocument` → Solar 요약.
- 페이지·문장: Solar 요약(샘슨 섹션 구조).
- 20자 미만은 LLM 없이 bad.

### Task 4: 3단계 research

**Files:** Create `_lib/research.ts`

**Produces:** `research(intake, summary, ctx): Promise<Research>`; `Research = { files: IntakeFile[]; applyUrl: string | null; needs: Need[]; title; organization; deadline }`.

- 후보 링크(intake.links + 요약 내 URL) → `solar-pro4` `{ attachments[], applyUrl }`. 다운로드. applyUrl 페이지 `formHints` → Solar 가 `Need[]`(research).

### Task 5: 4단계 analyze + 5단계 prefill + 병합

**Files:** Create `_lib/analyze.ts`, `_lib/prefill.ts`, `_lib/needs.ts`

**Produces:** `analyze(files, summary, ctx): Promise<{ needs: Need[]; applicationType: string|null; title: string|null }>`; `mergeNeeds(...lists): Need[]`; `prefill(needs, userId|null): Promise<Need[]>`.

### Task 6: pipeline + run 라우트

**Files:** Create `_lib/pipeline.ts`, `run/route.ts`

**Produces:** `runStart(input, emit, { userId })`. SSE 본문 `data: {json}\n\n`.

### Task 7: apply 라우트 + lab/notice 변경

**Files:** Create `apply/route.ts`; Modify `lab/notice/_lib/agent.ts` (`allowSubmit?: boolean`), `lab/notice/_lib/run-view.tsx` (`export function LiveScreen`).

### Task 8: 화면

**Files:** Create `_lib/start-flow.tsx`, `_lib/needs-form.tsx`; Modify `app/_lib/tabs.tsx`.

- 스테이지 레일 · 요약 카드 · 파일 목록 · Need 폼 · 자동 신청 · LiveScreen · 결과.

### Task 9: 검증

- `pnpm build` · lint · format:check.
- `/demo/hiring` 링크로 end-to-end 실행 (Studio 실호출). 파일 업로드 경로. 자연어만.
- AGENTS.md 에 플로우 섹션 추가.
