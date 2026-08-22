# LLM 계층 구조 개편 계획

> 이 문서의 모든 줄번호는 `c3e0546`(= `origin/main` 의 src 트리와 동일. 앞선 커밋 `161749d` 는 `.github/workflows/ci.yml` 만 건드린다) 기준으로 **직접 열어 확인했다.**
> **실측**은 이 문서를 쓰면서 실제로 돌려 본 것이고, **추정**은 코드에 박힌 상수로 계산한 것이다. 둘을 섞지 않았다.
>
> 사전 검토 문서 넷이 전제한 것 중 **네 가지는 코드와 다르다.** 그 위에 세운 무브는 버렸다. 무엇이 반증됐는지는 §0 끝에 따로 적는다.

---

## 0. 지금 무엇이 문제인가

### 0.1 축별 요약

| 축                       | 증상                                                                                                                                                                             | 근거 (파일:줄)                                                                                                                                                                                                                                                                                                                                                                                                       | 대가                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **관측**                 | LLM 호출 21곳 전부가 `usage`·`ms` 를 버린다. `usage`/`onFinish`/`experimental_telemetry` 참조가 저장소에 **0건** (매치는 `api/document/route.ts:69` 의 `parsed.usage?.pages` 뿐) | `src/lib/llm.ts:96-99` 가 `createOpenAICompatible({name,baseURL,apiKey,headers})` 만 넘긴다 — `fetch`·`includeUsage` 옵션이 비어 있다                                                                                                                                                                                                                                                                                | 어느 단계가 비싼지 **모른다.** 이 문서의 절감 추정치가 전부 추정으로 남는 이유                                                                                                                                                        |
| **관측**                 | 테스트·평가·골든셋 0건. `find` 결과 없음, `package.json` 에 `test` 스크립트도 러너도 없음                                                                                        | `package.json:6-25`                                                                                                                                                                                                                                                                                                                                                                                                  | 임계값 0.50(`memory.ts:31`)·0.6(`evidence.ts:81`)·0.5(`reconcile.ts:82`)를 바꿨을 때 무엇이 나빠지는지 알 수 없다                                                                                                                     |
| **관측**                 | `log` 이벤트를 화면이 안 읽는다. `start-flow.tsx:194-264` 의 `switch` 에 `case "log"` 가 없고 `case "verdict"`(226-227)·`case "via"`(224-225)는 `break` 뿐                       | 서버는 `pipeline.ts:78` 에서 모든 `ctx.log` 를 `emit({type:"log"})` 로 보낸다                                                                                                                                                                                                                                                                                                                                        | 「유효성 검사 실패 — Solar 로 대체」 같은 결정적 진단이 서버 콘솔에만 남는다                                                                                                                                                          |
| **오케스트레이션**       | 요약 단계가 파일을 **완전 직렬**로 돈다. 파일끼리 서로의 출력을 참조하지 않는다                                                                                                  | `summarize.ts:38-40` `for (const file of intake.files) parts.push(await summarizeFile(file, ctx))`                                                                                                                                                                                                                                                                                                                   | Studio job 하나가 45~~180초(`upstage-studio.ts:158`). **`stage("summarize")` 는 240초에 잘린다**(`pipeline.ts:53,120,174`) → 파일 2~~3개면 요약 단계가 통째로 실패하고 `pipeline.ts:175-178` 이 「요약에 실패했습니다」로 런을 끝낸다 |
| **오케스트레이션**       | 서술자 6회가 전부 `await` 로 크리티컬 패스에 있다. 산출물이 아니라 화면 문구다                                                                                                   | `pipeline.ts:159, 196, 211, 248, 287, 334` → `narrator.ts:59-60` 이 `bigModel()`                                                                                                                                                                                                                                                                                                                                     | 추정 4초×6 = **~24초**. `apply/route.ts:269, 300, 333` 은 이미 `void tell` 인데 준비 쪽만 await 다                                                                                                                                    |
| **오케스트레이션**       | `plan`(271)과 `documents`(301)가 직렬인데 `plan` 출력이 `documents` 인자에 안 들어간다                                                                                           | `pipeline.ts:271-285` vs `301-332` — 공유 인자는 `{title, organization, brief, filled}` 뿐                                                                                                                                                                                                                                                                                                                           | 두 단계 중 짧은 쪽만큼이 그냥 사라진다                                                                                                                                                                                                |
| **오케스트레이션**       | `planDocuments`(try/catch 없음)가 `documents` 스테이지 첫 줄이라, 던지면 그 뒤 `recallArtifacts`·`fillTemplates` 까지 통째로 사라진다 — 둘 다 그 결과에 의존하지 않는데          | `pipeline.ts:303` → `307`, `309` / `file-agent.ts:76-165` 에 try 없음                                                                                                                                                                                                                                                                                                                                                | 보관함 사업자등록증과 공고가 준 hwp 지정 서식이 「분류 모델이 한 번 흔들렸다」는 이유로 없어진다                                                                                                                                      |
| **오케스트레이션**       | 취소가 없다. `abortSignal` 사용처는 저장소 전체에서 `fetch.ts:52` 하나                                                                                                           | `run/route.ts:59-99` 의 `ReadableStream` 에 `cancel()` 없음. `withTimeout`(`pipeline.ts:55-68`)은 `Promise.race` 라 240초 뒤에도 **진 쪽은 계속 돈다** — Studio 폴링·Solar 호출·Chromium                                                                                                                                                                                                                             | 탭을 닫아도 Studio job 2건 + bigModel 십수 회가 끝까지 청구된다                                                                                                                                                                       |
| **컨텍스트**             | 브라우저 도구 루프에 컨텍스트 폐기가 없다. `prepareStep` 사용처 **0건**                                                                                                          | `playwright-agent.ts:596-602` — `generateText({model, tools, stopWhen, system, prompt})` 가 전부                                                                                                                                                                                                                                                                                                                     | 스냅샷이 무한 누적, 입력이 스텝 수의 제곱으로 는다. `apply/route.ts:368` 이 `maxSteps: 60`                                                                                                                                            |
| **컨텍스트**             | 같은 파일을 Upstage 에 두 번 올리고 두 번 파싱한다. 첫 job 이 낸 파싱 결과를 **길이만 재고 버린다**                                                                              | `summarize.ts:82-87` 업로드 → `91-94` `const chars = (parsed?.content?.markdown ?? ...).length` / `analyze.ts:70-72` 같은 파일 재업로드                                                                                                                                                                                                                                                                              | Document Parse 는 페이지 과금. 20쪽+10쪽이면 30쪽이 아니라 60쪽                                                                                                                                                                       |
| **컨텍스트**             | `clip` 상한이 8k/10k/12k/14k/30k 로 제각각이고, 잘렸다는 사실을 아무도 기록하지 않는다                                                                                           | `start/_lib/llm.ts:22-23` — 기본 30,000 이 실제로 쓰이는 곳은 `summarize.ts:143` 한 곳뿐                                                                                                                                                                                                                                                                                                                             | 컨텍스트 초과는 400 으로 오는데 그 지점이 전부 catch 폴백 안이라 **실패가 조용히 품질 저하로 바뀐다**                                                                                                                                 |
| **라우팅**               | 티어링이 프로바이더 이름 비교 한 줄이다. `bigModel()` 은 `chatModel()` 과 글자 그대로 같다                                                                                       | `start/_lib/llm.ts:10-19`                                                                                                                                                                                                                                                                                                                                                                                            | `LLM_PROVIDER=azure` 로 바꾸는 순간 intake 2회·judge 1회가 최상위 모델로 올라간다. 반대로 `LLM_MODEL=solar-pro3` 를 명시해도 `chatModel("solar-mini")` 가 덮는다                                                                      |
| **라우팅**               | `narrate` 가 `bigModel()` 이다 (`smallModel()` 아님)                                                                                                                             | `narrator.ts:60`                                                                                                                                                                                                                                                                                                                                                                                                     | 화면 문구 6회가 solar-pro4                                                                                                                                                                                                            |
| **검증**                 | 계약 문자열이 손으로 복제돼 있고 강제 수단이 문서뿐                                                                                                                              | 12개 호출부 전수 확인 — 예: `research.ts:243` 의 select/options 지시와 `reconcile.ts:46` 이 글자 하나 안 틀리고 같다                                                                                                                                                                                                                                                                                                 | 새 `generateObject` 를 추가하는 사람이 계약 줄을 빠뜨리면 「필드명을 지어내는」 옛 증상이 돌아온다                                                                                                                                    |
| **검증**                 | 복구 루프가 없다. `maxRetries`·`repairText` 지정 0건                                                                                                                             | `ai` 7.0.71 의 `maxRetries` 는 `doGenerate` 만 감싸고 zod 실패는 그 밖에서 던진다                                                                                                                                                                                                                                                                                                                                    | 계약을 **한 번** 어기면 곧장 폴백 (`research.ts:200`, `reconcile.ts:94`, `analyze.ts:121`)                                                                                                                                            |
| **검증**                 | 형식은 맞는데 내용이 틀린 값을 잡는 곳이 없다. `deadline` 은 프롬프트로만 `YYYY-MM-DD` 를 요구                                                                                   | `research.ts:170` 프롬프트 / `pickLinks` 반환 `research.ts:194` 는 `trim()` 만                                                                                                                                                                                                                                                                                                                                       | 「2026년 9월 중」이 그대로 스냅샷·계획·`plan.ts:69` 기한 역산으로 흐른다                                                                                                                                                              |
| **검증**                 | `pick()` 의 빈 키가 와일드카드다                                                                                                                                                 | `documents.ts:16-25` 의 `NOISE` 가 「제출」·「서류」를 지워 `documentKey("제출 서류") === ""`, `file-agent.ts:122` 의 `key.includes(item.key)` 가 항상 참                                                                                                                                                                                                                                                            | **실측**: `pick("사업계획서")` 가 정확일치 실패 시 「제출 서류」를 돌려준다                                                                                                                                                           |
| **검증**                 | 제출 성공 판정이 모델의 자기보고다                                                                                                                                               | `playwright-agent.ts:605` `summary: result.text` → `apply/route.ts:377-379`                                                                                                                                                                                                                                                                                                                                          | 접수번호 대조가 없다. `allowSubmit: true`(`:369`) 로 실제 접수를 한다                                                                                                                                                                 |
| **정확도 (죽은 코드)**   | **캡챠 중도 전환이 동작하지 않는다**                                                                                                                                             | `guard()`(`playwright-agent.ts:213-219`)의 `throw new CaptchaFound` 는 `read()`(:231)·`diagnose`(:278)·fill(:415)·click(:445,:488)·upload(:540)·scroll(:559) — **전부 도구 `execute` 안**이다. AI SDK 는 도구 예외를 `dist/index.js:3042` 에서 잡아 `tool-error` 출력으로 바꾸고 루프를 계속한다. 성공 경로 `:604-610` 은 `captcha: null` 을 **리터럴로** 반환 → `apply/route.ts:374` `if (!run.captcha)` 가 항상 참 | 제출 뒤에 뜨는 캡챠(AGENTS.md 가 「흔하다」고 적은 경우)를 만나면 모델이 「캡챠」 문자열만 받으며 남은 스텝(최대 60)을 태우고, apply 는 그걸 성공으로 보고 `done` 을 쏜다. **수동 모드 전환이 한 번도 열리지 않는다**                 |
| **정확도 (화면 거짓말)** | 신청이 성공해도 브라우저 카드가 빨간 「연결이 끊겨 중단됐다」로 끝난다                                                                                                           | `apply/route.ts:424` `controller.close()` → `:428` `emit({agent:"browser", status:"done"})` (닫힌 컨트롤러라 `:186-190` catch 가 삼킨다) → 클라이언트 `start-flow.tsx:441` 의 `settleCards` 가 running 카드를 error 로 덮는다(`:168-181`)                                                                                                                                                                            | 사용자가 이미 접수된 신청을 실패로 읽고 다시 시도한다                                                                                                                                                                                 |
| **정확도 (죽은 배선)**   | `recallNarratives` 가 **프로덕션에서 한 번도 실행되지 않는다**                                                                                                                   | `file-agent.ts:191` `context.userId ? ... : []` — 호출부 둘 다 userId 를 안 넘긴다: `pipeline.ts:316`, `apply/route.ts:291`                                                                                                                                                                                                                                                                                          | 「이 제품의 해자」라는 서술 검색용 벡터(`memories.embedding`)가 쓰이지 않는다. 부수적으로 「유사도 하한 없는 top-5」(`memory.ts:160-176`) 결함은 **잠재적**이지 활성이 아니다                                                         |
| **정확도 (죽은 배선)**   | 신청 결과를 서버가 기록하지 않는다                                                                                                                                               | `saveApplyResult`(`session.ts:76`) 호출부 **0건** (grep). 실제 저장은 클라이언트 `start-flow.tsx:446-457` 의 `/app/goals` PATCH                                                                                                                                                                                                                                                                                      | `session.ts:71-74` 가 실측 근거로 막으려 한 상태 — 「제출해 놓고 아무 데도 기록하지 않는」 — 가 회피 대상이 아니라 **현재 상태**다                                                                                                    |
| **성능 (DB)**            | pgvector HNSW 인덱스가 두 조회 경로 모두에서 **안 쓰인다**                                                                                                                       | `memory.ts:120` `1 - (${cosineDistance(...)})` 를 `orderBy(desc(...))` 로 쓴다. drizzle 0.45.2 가 내는 SQL 은 `ORDER BY 1 - (col <=> $v) DESC` 이고, HNSW 는 `ORDER BY col <=> $v ASC` 형태에만 붙는다                                                                                                                                                                                                               | **실측** (아래 0.2)                                                                                                                                                                                                                   |
| **성능 (DB)**            | 임베딩은 배치인데 검색이 N+1 순차                                                                                                                                                | `memory.ts:117` 배치 1회 → `:119-133` 라벨마다 `await db.select(...)`. 1단계(`:96-101`)는 `select()` 로 1024차원 벡터 두 벌을 행마다 끌어온다                                                                                                                                                                                                                                                                        | 항목 20개면 최대 20회 순차 왕복 × 전체 seq scan                                                                                                                                                                                       |
| **보안/신뢰경계**        | `/steer` 에 소유권 검사가 없다                                                                                                                                                   | `steer/route.ts:31-45` 에 세션 조회 없음. 인증 자체는 `proxy.ts:53` matcher 가 강제한다(`/app/:path*`) → 즉 빠진 것은 인가. `run-registry.ts:17-23` 의 `Run` 에 `userId` 필드가 없다                                                                                                                                                                                                                                 | 로그인한 아무 사용자가 runId 만 알면 `allowSubmit:true` 로 도는 남의 신청 폼에 최대 4000자 값을 꽂을 수 있다                                                                                                                          |
| **보안/신뢰경계**        | 클라이언트가 서버 파일 경로를 정하고 에이전트가 그것을 외부 사이트에 업로드한다                                                                                                  | `apply/route.ts:66-75` `artifacts[].path: clamped(500)` 무검증 → `playwright-agent.ts:520` `setInputFiles(picked.path)`. `applyUrl` 도 같은 요청이 정한다(`:42`)                                                                                                                                                                                                                                                     | 로그인 사용자 한 명이 임의 컨테이너 파일을 자기 서버로 유출할 수 있다                                                                                                                                                                 |
| **보안/신뢰경계**        | 업로드 경로 조립이 무방비                                                                                                                                                        | `documents/route.ts:34` `runId` 폼 필드 → `:64-67` `join(artifactDir(runId), file.name)`. 같은 모듈의 `safeName`(`file-agent.ts:451-457`)을 여기만 안 쓴다. `artifactDir` 은 `join(tmpdir(),"antelope-artifacts",runId)`(`:447-449`)                                                                                                                                                                                 | 디렉터리 탈출                                                                                                                                                                                                                         |
| **보안/비용**            | 무인증 LLM·문서 라우트                                                                                                                                                           | `proxy.ts:53` matcher 는 `["/app","/app/:path*","/sign-in"]`. 밖에 있는 것: `/api/chat`(`route.ts:7-15`, 클라이언트가 `system` 을 통째로 지정, 길이 상한 없음), `/api/document`, `/api/document/extract`(MAX_BYTES 검사조차 없다 — `/api/document/route.ts:7,30` 에는 있다), `/playground`, `/lab/*` 전체                                                                                                            | 배포 URL 로 팀 키를 무제한 소비 가능                                                                                                                                                                                                  |
| **자원**                 | Chromium 상한이 가장 덜 쓰이는 경로에만 있다                                                                                                                                     | 수동 모드는 `desktop.ts:50` `MAX_SESSIONS = 2`. 자동 모드(기본)는 상한 0이고 apply 한 건이 `probeCaptcha`(`apply/route.ts:353`) + 본 실행(`:361`)으로 둘을 띄운다. `render/pdf.ts:15-31` 은 문서마다 launch/close, `pdfCopy`(`file-agent.ts:280`)가 한 번 더                                                                                                                                                         | `documents` 를 병렬화하면 문서 3편 = Chromium 6개. `/api/health:11-14` 가 경고한 그 OOM                                                                                                                                               |
| **자원**                 | `artifactDir` 을 지우는 코드가 0건                                                                                                                                               | grep 결과 생성·쓰기만. `rm` 은 `render/hwp.ts` 의 별개 임시 디렉터리에만                                                                                                                                                                                                                                                                                                                                             | 실행마다 문서 + PDF 사본 + 사용자 업로드(각 5MB)가 상주 컨테이너 tmpdir 에 영구히 쌓인다                                                                                                                                              |
| **구조**                 | 프로덕션이 lab 을 import 한다                                                                                                                                                    | `analyze.ts:6` (`lab/analysis/_lib/workflow` 의 `BRIEF`), `prefill.ts:2`, `file-agent.ts:7` (`lab/notice/_lib/memory`), `hub/page.tsx:4`                                                                                                                                                                                                                                                                             | AGENTS.md 의 「버릴 때는 폴더를 지우면 그게 전부」가 성립하지 않는다. lab/analysis 를 지우면 프로덕션 Studio Config 정의도 함께 사라진다                                                                                              |
| **낭비**                 | 이미 청구 중인 신호를 파싱 단계에서 버린다                                                                                                                                       | `lab/analysis/_lib/workflow.ts:180-181, 197-198` 이 `confidence: true, location: true` 를 켜고 `:54` 가 `formName` 을 요구하는데, `analyze.ts:39-56` 의 `fieldSchema` 에 그 셋이 없어 zod strip 이 지운다                                                                                                                                                                                                            | `formName`(지정 양식 이름)은 `fillTemplates`(`file-agent.ts:339-392`)가 파일명 매칭으로 대신 찾고 있는 바로 그 값이다                                                                                                                 |
| **낭비**                 | 근거 하이라이트가 프로덕션 경로에 재료 자체가 없다                                                                                                                               | `studio-workflow.ts:125` 는 `coordinates: true` 인데 `lab/analysis/_lib/workflow.ts:144-153`·`lab/validation/_lib/workflow.ts:46-56` 은 없다. `parsedElements`(`upstage-studio.ts:270-273`)는 좌표 4점 없는 요소를 버린다                                                                                                                                                                                            | 「이 값 어디서 나왔어?」가 실험(`/lab/notice`)에만 있고 실제 사용자 플로우에는 없다                                                                                                                                                   |

### 0.2 실측 — pgvector 인덱스

로컬 `antelope-db-1`(pgvector 0.8.6)에 `idxtest(user_id text, emb vector(1024))` 5,000행 + `hnsw (emb vector_cosine_ops)` 를 만들고 `EXPLAIN (ANALYZE)` 로 세 형태를 비교했다. 테스트 테이블은 즉시 DROP 했다 (실제 `memories` 는 이 개발 DB에 6행뿐이라 그대로는 플래너 판정이 안 나온다).

| 형태                                                                                           | 계획                               | Execution Time |
| ---------------------------------------------------------------------------------------------- | ---------------------------------- | -------------- |
| **A. 저장소 현재** — `WHERE 1-(emb<=>v) > 0.5 ORDER BY 1-(emb<=>v) DESC LIMIT 1`               | `Seq Scan on idxtest`              | **17.902 ms**  |
| B. 정석 — `ORDER BY emb <=> v ASC LIMIT 1`                                                     | `Index Scan using idxtest_emb_idx` | 0.199 ms       |
| **C. 거리 상한 + ASC** — `WHERE user_id='u1' AND (emb<=>v) < 0.5 ORDER BY emb<=>v ASC LIMIT 1` | `Index Scan using idxtest_emb_idx` | **0.100 ms**   |

C 는 **임계값 0.50 의 의미를 글자 그대로 보존한다** — 코사인 거리 < 0.5 ⟺ 코사인 유사도 > 0.5. `memory.ts:31` 의 실측 근거(정답쌍 0.578 / 오답 최고 0.435)를 건드리지 않고 ~90배가 나온다. `schema.ts:162-169` 의 두 HNSW 인덱스는 지금 **한 번도 안 쓰인다.**

### 0.3 실측 — 프롬프트 크기 (system 리터럴 문자 수)

| 호출                                          | system      | prompt 상한 (코드에 박힌 값)                                                                                       |
| --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `intake.readText` (`intake.ts:129`)           | 244자       | `clip(text, 8_000)`                                                                                                |
| `intake.pickAttachments` (`:158`)             | 206자       | 링크 ≤40개(`:99`) × (텍스트 ≤80 + URL)                                                                             |
| `summarize.solarSummary` (`summarize.ts:134`) | 257자       | `clip(text)` = **기본 30,000** (`start/_lib/llm.ts:22`. 이 기본값이 쓰이는 유일한 자리)                            |
| `summarize.judge` (`:182`)                    | 249자       | `clip(summary.markdown, 12_000)`                                                                                   |
| `research.pickLinks` (`research.ts:162`)      | 504자       | `clip(markdown, 10_000)` + 링크 ≤60(`:138`)                                                                        |
| `research.deriveNeeds` (`:236`)               | 680자       | `clip(markdown,10_000)` + formHints ≤80(`fetch.ts:199`) + placeholders ≤60(`:209`) + `clip(applyPage.text, 6_000)` |
| `analyze.solar` (`analyze.ts:105`)            | 745자       | `clip(summary.markdown, 12_000)`                                                                                   |
| `reconcile` (`reconcile.ts:39`)               | 735자       | 두 목록 ≤20개씩 × (label ≤60 + why ≤160)                                                                           |
| `plan` (`plan.ts:54`)                         | 721자       | `clip(brief \|\| summary, 14_000)`                                                                                 |
| `narrate` ×6 (`narrator.ts:59`)               | 439자       | history ≤8턴(`:82`) + `clip(facts, 12_000)`. analyze 자리는 brief 앞 2,500자를 통째로(`pipeline.ts:219`)           |
| `planDocuments` (`file-agent.ts:84`)          | 712자       | `clip(brief, 8_000)`                                                                                               |
| `writeDocument` ×N (`:200`)                   | 332자       | known needs + `clip(context.brief, 10_000)`                                                                        |
| `playwright-agent` systemPrompt (`:688-724`)  | **1,822자** | + 스텝마다 스냅샷                                                                                                  |
| `agent.ts`(수동) system (`:331-366`)          | **1,991자** | + 스텝마다 OCR 줄                                                                                                  |

> 사전 설계 문서가 브라우저 시스템 프롬프트를 「4,383자」로 잡았는데 실제로는 **1,822자**다(양쪽 ternary 분기를 다 세도). 시스템 프롬프트는 최적화 대상이 아니다.

### 0.4 추정 — 어디에 토큰이 가는가

**계산 근거를 밝힌다. 이 값들은 §3 Step 1(계측) 이 끝나면 측정치로 갈아끼운다.**

**(가) 준비 파이프라인의 중복 전송.** 원문은 중복되지 않는다 — 각 파일·페이지가 `solarSummary` 를 한 번씩 탄다. 중복되는 것은 **산출물**이다.

가정: 요약 5,500자, brief 6,000자, 작성 문서 2편.

- `summary.markdown` → judge 5,500 + pickLinks 5,500 + deriveNeeds 5,500 = **16,500자**
- `brief` → plan 6,000 + planDocuments 6,000 + writeDocument 6,000×2 = 24,000, + narrate(analyze) 2,500 = **26,500자**
- 합계 **≈ 43,000자**. 준비 파이프라인 전체 입력의 절반 안팎이 같은 글자다.

**(나) 브라우저 루프의 누적.** `SNAPSHOT`(`playwright-agent.ts:33-89`)이 요소마다 label ≤90(`:69`) + value ≤70(`:70`) + validationMessage ≤120(`:80`) + accept ≤120(`:82`) + href ≤200(`:85`) + options ≤25개(`:75`) 를 싣고, `화면 글` 이 ≤1,800(`:88`). 요소 40개 폼에서 요소당 실사용 ~100자로 잡으면 **스냅샷 1장 ≈ 5.8KB.**

`click` 은 결과에 `read()` 를 통째로 붙인다(`:473`, 의도된 최적화 — 주석에 「도구 71회 245초, 병목은 모델 왕복」 실측이 있다). `prepareStep` 이 없으므로 스텝마다 append-only 로 쌓인다:

- 스냅샷 20장이 쌓이는 34스텝 실행 → 마지막 요청 ≈ 20 × 5.8KB = **116KB**, 누적 입력 ≈ 20×21/2 × 5.8KB ≈ **1.2MB 문자**
- `apply/route.ts:368` 의 실제 `maxSteps: 60` → 곡선이 n² 라 3배 이상

**단일 실행 비용의 대부분이 여기 있을 가능성이 높지만, 지금 확인할 방법이 없다.** 그래서 계측이 1번이다.

### 0.5 사전 설계 문서에서 **버린** 주장

| 버린 주장                                                                   | 실제                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 「준비 단계에 타임아웃이 없다」                                             | **있다.** `pipeline.ts:53` `STAGE_TIMEOUT_MS = 240_000`, `:55-68` `withTimeout`, `:120` 모든 stage 에 적용, `:230-240` reconcile 에도. 없는 것은 **취소**이고, `withTimeout` 이 `Promise.race` 라 진 쪽이 계속 도는 것이 남은 문제다                                                                                                                        |
| 「SSE 하트비트가 없어 프록시가 끊는다」                                     | **있다.** `run/route.ts:76-82`·`apply/route.ts:196-202` 가 15초마다 `: ping`. 주석에 이유(Studio 폴링 180초 침묵)까지 적혀 있다                                                                                                                                                                                                                             |
| 「파일 6개 × 180초 = 1080초가 `maxDuration=600` 을 넘겨 런이 잘린다」       | **maxDuration 은 강제되지 않는다.** `next.config.ts:4` `output:"standalone"` + Dockerfile `CMD ["node","server.js"]`, `railway.json` 에 timeout 없음 → Next build output 의 maxDuration 을 읽는 플랫폼이 없다. 실제로 자르는 것은 `STAGE_TIMEOUT_MS` 240초이고, 그래서 **파일 2~3개만 돼도 요약 스테이지가 통째로 실패한다** — 원 주장보다 문턱이 훨씬 낮다 |
| 「브라우저 카드가 영원히 running 으로 남는다」                              | 증상이 반대다. `start-flow.tsx:441` 의 `settleCards` 가 running 카드를 **error 로 내린다** → 성공한 신청이 빨간색 「연결이 끊겨 중단됐다」로 끝난다. 고칠 값어치는 더 크다                                                                                                                                                                                  |
| 「`ANSWER_TIMEOUT_MS`(15분)와 `maxDuration`(900초)이 같아 라우트가 죽는다」 | maxDuration 이 강제되지 않으므로 동시 만료가 아니다. 15분 파킹이 나쁜 이유는 그동안 Chromium/Xvfb 세션(`desktop.ts:50` `MAX_SESSIONS=2`)을 점유해 **다음 사용자의 신청이 거절된다**는 것이다                                                                                                                                                                |
| 「`generateObject` 에 `timeout` 을 넣는다」                                 | `ai@7.0.71` 의 `generateObject` 는 `Omit<RequestOptions,'timeout'>`(`dist/index.d.ts:7325`). `abortSignal`·`maxRetries` 만 있다. `generateText`/`streamText` 는 `timeout` 이 있다(`:4726`, `:3394`)                                                                                                                                                         |
| 「apply 결과가 DB 에 전혀 남지 않는다」                                     | 남는다 — 단 **클라이언트가 살아 있을 때만**. `start-flow.tsx:446-457` 이 `/app/goals` PATCH. 서버 측 `saveApplyResult`(`session.ts:76`)는 호출부 0건                                                                                                                                                                                                        |
| 「`/steer` 에 인증이 없다」                                                 | 인증은 `proxy.ts:53` matcher(`/app/:path*`)가 DB 세션까지 검증해 강제한다. 빠진 것은 **인가(소유권)** 하나다 — `run-registry.ts:17-23` 의 `Run` 에 `userId` 가 없다                                                                                                                                                                                         |
| 「Studio 가 필드별 `confidence` 를 이미 주고 있다」                         | 플래그가 켜진 것(`lab/analysis/_lib/workflow.ts:180-181`)과 응답이 실제로 그 값을 싣는 것은 별개다. 관측한 적이 없으므로 「추가 비용 0」 근거로 쓰지 않는다. 반면 **`formName`(`:54`)은 스키마가 요구하는 필드**이고 `analyze.ts:39-56` 이 확실히 버린다                                                                                                    |

---

## 1. 목표 구조

**래퍼는 하나다.** 네 갈래 설계가 각각 `gateway.ts`·`flow/runner.ts`·`structured.ts`·`context-store.ts` 를 제안했는데, 넷 다 같은 자리(호출부와 모델 사이)에 앉는다. 넷을 병렬로 만들면 같은 8개 파일(≈1,900줄)을 네 번 다시 쓴다 — 3인이 같은 `main` 에 직접 푸시하는 저장소에서 그것은 리베이스 전면전이다.

그리고 **오케스트레이션 계층은 새로 만들지 않는다.** 단계 단위 횡단 지점은 `pipeline.ts:112-127` 의 `stage()` + `withTimeout` 으로 이미 있다. 없는 것은 **모델 호출 단위** 지점 하나뿐이다.

```
src/lib/
  llm.ts              (유지) chatModel/llmInfo — 게이트웨이 위의 얇은 shim 으로 재구현
  ai/
    catalog.ts        프로바이더 × 티어 × 능력 표. 선언만, 로직 없음
    tasks.ts          작업 → 정책 표(티어·타임아웃·재시도·레인). 선언만
    runtime.ts        provider 캐시 · 계측 fetch · 레인 세마포어 · 폴백 체인   [비공개]
    ledger.ts         usage·ms·실패율 원장 (링버퍼 + /api/health 노출)
    gateway.ts        단일 진입점 — runObject / runText / runToolLoop / runStream / embedTexts / runStudio
    contract.ts       zod 스키마 → 계약 문자열 렌더 + 계약 위반 복구 루프
    verify.ts         의미 검증 규칙 키트 (날짜·화이트리스트·단위·플레이스홀더·중복·서류분류)
    context.ts        ContextStore — 파일 1회 파싱, 계층 뷰(headline/facts/brief/summary/raw)
  upstage-studio.ts   (수정) createJob(fileIds[]) · waitForJob(signal, include 전환)
  grounding.ts        (이동) lab/notice/_lib/evidence.ts 승격. 원 위치에는 re-export 한 줄
  workflows/
    analysis.ts       (이동) lab/analysis/_lib/workflow.ts 승격 — 프로덕션 Config 의 유일한 정의
    validation.ts     (이동) lab/validation/_lib/workflow.ts 승격
```

각 모듈 한 줄:

- **catalog.ts** — 어떤 프로바이더가 어떤 티어에 어떤 모델을 갖고 무엇을 할 수 있는지. 코드 분기 대신 표.
- **tasks.ts** — 22개 작업 각각이 어느 티어·어느 상한·어느 레인에서 도는지. 리뷰가 diff 로 된다.
- **runtime.ts** — provider 를 한 번만 만들고, 계측 `fetch` 를 물리고, 레인별 동시성을 지키고, 폴백 사슬을 돌린다.
- **ledger.ts** — 모든 왕복의 토큰·지연·실패를 한 곳에 모은다. 개선을 증명하는 유일한 근거.
- **gateway.ts** — 호출부가 보는 전부. 타임아웃·취소·재시도·집계·계약·검증이 여기 한 번에 걸린다.
- **contract.ts** — Upstage 가 zod 를 모델에 안 넘긴다는 사실(AGENTS.md)을 **구조적으로** 우회한다. 계약 문자열을 손으로 쓰는 일이 없어진다.
- **verify.ts** — 브라우저·정규식·화이트리스트가 답할 수 있으면 모델에게 묻지 않는다.
- **context.ts** — 파일을 한 번만 파싱하고, 단계마다 필요한 최소 뷰만 준다.

### 핵심 타입

```ts
// src/lib/ai/catalog.ts
export type Capability = "nativeJsonSchema" | "toolCalling" | "streaming";
export type Tier = "nano" | "small" | "large";

export type ModelSpec = {
  id: string; // 모델 id, Azure 는 배포 이름
  contextChars: number; // 토크나이저가 없으므로 clip 예산 단위인 '문자'로 센다
  caps: readonly Capability[];
};

export type ProviderSpec = {
  id: ProviderId; // env.LLM_PROVIDER 유니온과 동일
  baseURL?: string;
  apiKey?: string;
  headers?: (apiKey: string) => Record<string, string>;
  /** createOpenAICompatible 에 그대로 전달. Upstage 는 false — 프롬프트 계약 우회를 유지한다 */
  supportsStructuredOutputs: boolean;
  tiers: Partial<Record<Tier, ModelSpec>>; // 빈 티어는 위로 승격하고 그 사실을 warnings 에 남긴다
  embedding?: { query: string; passage: string; dims: 1024 };
};

export const PROVIDERS: Record<ProviderId, ProviderSpec>;
export function pickModel(
  p: ProviderSpec,
  tier: Tier,
  needs: readonly Capability[],
): { spec: ModelSpec; promotedFrom: Tier | null; unmet: Capability[] };
```

```ts
// src/lib/ai/tasks.ts
export type TaskId =
  | "intake.read"
  | "intake.pickAttachments"
  | "summarize.text"
  | "summarize.judge"
  | "research.pickLinks"
  | "research.deriveNeeds"
  | "analyze.fields"
  | "reconcile"
  | "prefill.embed"
  | "plan"
  | "narrate"
  | "documents.plan"
  | "documents.write"
  | "knowledge.curate"
  | "notice.extract"
  | "notice.subagent"
  | "browser.auto"
  | "browser.manual"
  | "playground.chat"
  | "studio.validation"
  | "studio.analysis"
  | "studio.notice";

export type TaskSpec = {
  tier: Tier;
  needs: readonly Capability[];
  /** 벽시계 상한. generateObject 는 timeout 옵션이 없어 AbortSignal 로만 건다 */
  timeoutMs: number;
  retries: number; // SDK maxRetries 로 전달 (전송 계층 전용)
  degradeTo?: Tier | null; // 큰 모델 실패 → 작은 모델
  lane: "interactive" | "batch" | "studio" | "browser";
  stream: boolean;
};
export const TASKS: Record<TaskId, TaskSpec>;
```

```ts
// src/lib/ai/gateway.ts
export type CallMeta = {
  task: TaskId;
  runId?: string;
  userId?: string;
  signal?: AbortSignal; // 취소의 유일한 통로
  log?: (line: string) => void; // 폴백·승격·절단이 화면까지 가는 통로
};

export type CallResult<T> = {
  value: T;
  usage: { input: number; output: number };
  ms: number;
  used: { provider: ProviderId; model: string; tier: Tier };
  degraded: boolean;
  attempts: number;
  issues: Issue[];
  warnings: string[];
};

/** 체인을 다 소진하면 throw 한다 — 기존 12개 try/catch 폴백이 문장 하나 안 바뀌고 그대로 동작한다 */
export class AiGatewayError extends Error {
  readonly task: TaskId;
  readonly attempts: number;
}

export function runObject<Raw, Out = Raw>(
  meta: CallMeta,
  opts: {
    name: string;
    schema: z.ZodType<Raw>; // 지금처럼 전부 .nullish()
    normalize?: (raw: Raw) => Out; // 기존 normalize/toAnalysis/makeNeed 를 여기로
    verify?: (v: Out, c: VerifyCtx) => Issue[];
    rules: string[]; // 계약을 뺀 순수 규칙 문장만
    prompt: string;
    repair?: number; // 기본 1. fallback 이 있는 호출부는 0
    fallback?: (r: { issues: Issue[]; raw: string | null }) => Out;
    maxOutputTokens?: number;
  },
): Promise<CallResult<Out>>;

export function runText(
  meta: CallMeta,
  opts: {
    system: string;
    prompt: string;
    maxOutputTokens?: number;
  },
): Promise<CallResult<string>>;

export function runToolLoop<T extends ToolSet>(
  meta: CallMeta,
  opts: {
    system: string;
    prompt: string;
    tools: T;
    maxSteps: number;
    prepareStep?: PrepareStepFunction<T>; // 오래된 스냅샷 폐기 지점
    onStepFinish?: GenerateTextOnStepFinishCallback<T>;
    stepTimeoutMs?: number;
    toolTimeoutMs?: number; // v7 timeout: {stepMs, toolMs}
  },
): Promise<CallResult<GenerateTextResult<T, never>>>;

export function runStream(
  meta: CallMeta,
  opts: {
    system?: string;
    messages: ModelMessage[];
  },
): StreamTextResult<ToolSet, never>;

export function embedTexts(
  meta: CallMeta,
  values: string[],
  kind: "query" | "passage",
): Promise<CallResult<number[][]>>; // embedMany + maxParallelCalls

export function runStudio<T>(
  meta: CallMeta,
  opts: {
    agentId: string;
    files: Blob[];
    filenames?: string[];
    parse: (job: StudioJob) => T;
    fallback: () => Promise<T>; // Studio 실패 → Solar. 사슬을 여기 한 곳에만 둔다
  },
): Promise<CallResult<T>>;

export function llmHealth(): Promise<{
  provider: ProviderId;
  model: string;
  reachable: boolean;
  latencyMs?: number;
  studio: Record<string, boolean>;
  recent: UsageSummary;
}>;
```

```ts
// src/lib/ai/context.ts
export type DocId = string; // sha256(bytes).slice(0,16)
export type DocView = {
  id: DocId;
  name: string;
  fileId: string | null; // Studio /v2/files 의 id — 두 번째 job 이 재사용한다
  parsed: string | null; // parse 스텝 원문 Markdown. 지금 summarize.ts:91-94 가 버리는 그것
  summary: string | null;
  via: string;
  chars: number;
};
export type ViewKind = "headline" | "facts" | "brief" | "summary" | "raw";

export interface ContextStore {
  putDoc(name: string, blob: Blob): Promise<DocId>;
  setFileId(id: DocId, fileId: string): void;
  setParsed(id: DocId, markdown: string): void;
  setSummary(id: DocId, markdown: string, via: string): void;
  putField(k: "title" | "organization" | "deadline" | "applyUrl", v: string | null): void;
  putBrief(markdown: string): void;
  docs(): DocView[];
  /** 계층 뷰. 단계는 필요한 최소치만 받는다. 잘리면 meta.log 로 남긴다 */
  view(kind: ViewKind, opts?: { max?: number }): string;
}
```

**계층 뷰 규칙** — 원문은 요약을 만들 때 한 번만 흐르고, 그 아래로는 요약본만 돈다.

| 뷰         | 상한     | 담는 것                                                                                                                               | 받는 단계                            |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `headline` | 400자    | 제목·주관·마감·신청URL·파일명·항목 수                                                                                                 | judge, narrate, pickLinks            |
| `facts`    | 1,500자  | headline + 요약에서 자격·금액·기한·제출서류만 뽑은 표 (순수 코드. 요약이 `SECTIONS`(`summarize.ts:33`) 고정 구조라 정규식으로 갈린다) | plan, planDocuments                  |
| `summary`  | 6,000자  | 4섹션 요약 전문                                                                                                                       | deriveNeeds                          |
| `brief`    | 6,000자  | 준비 문서                                                                                                                             | writeDocument — 여기는 진짜 필요하다 |
| `raw`      | 30,000자 | 파싱 원문                                                                                                                             | solarSummary, Solar 폴백             |

---

## 2. 축별 설계

### 2.1 라우팅

**현재 → 목표**

|              | 현재                                                                                                                        | 목표                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 티어 결정    | `start/_lib/llm.ts:12-14` 의 `info.provider === "upstage"` 한 줄                                                            | `TASKS[task].tier` → `pickModel(provider, tier, needs)`                    |
| `bigModel()` | `chatModel()` 과 글자 그대로 같다 (`:17-19`)                                                                                | 존재하지 않는다. 작업이 티어를 말한다                                      |
| Azure 티어링 | 불가능 (배포 이름 하나)                                                                                                     | `env.LLM_MODEL_SMALL` 로 배포를 둘 등록하면 선언적으로 살아난다            |
| 폴백         | 호출부마다 손으로 짠 catch 5벌 (`summarize.ts:101`, `analyze.ts:92`, `intake.ts:147`, `research.ts:200`, `reconcile.ts:94`) | `degradeTo` + `runStudio(fallback)` 로 사슬을 게이트웨이 한 곳에           |
| 동시성       | 없음                                                                                                                        | 레인 세마포어 — `studio` 3 / `interactive` 4 / `batch` 2 / **`browser` 2** |

**핵심 결정 셋**

1. **`browser` 레인을 만든다.** 이 컨테이너에서 실제로 OOM 을 내는 자원은 토큰이 아니라 Chromium 이다. `desktop.ts:50` 의 `MAX_SESSIONS=2` 는 가장 덜 쓰이는 경로에만 걸려 있고, 기본 경로인 자동 모드는 상한이 0이며 `render/pdf.ts:15` 는 문서마다 브라우저를 새로 띄운다. `probeCaptcha`·`runPlaywrightAgent`·`renderPdf`·`openSession` 을 전부 이 레인 아래로 넣는다. **병렬화 무브(§3 Step 2)는 이것 없이 들어가면 안 된다.**

2. **`supportsStructuredOutputs` 는 표에서 온다.** Upstage 는 `false` 로 둔다 — AGENTS.md 가 못박은 「프롬프트에 필드 계약을 직접 박는다」 우회가 그대로 유지되고, 데모 경로에서 나가는 HTTP 바이트가 이전과 동일해진다(회귀 없음의 검증 기준). OpenAI/Azure 에서만 `true` 로 켜서 진짜 `json_schema` 가 나가게 하되, `LLM_STRUCTURED_OUTPUTS=off` 킬스위치를 둔다. **프롬프트의 계약 문장은 어느 쪽이든 지우지 않는다** — 있어도 무해하고, 지우면 Upstage 에서 즉사한다.

3. **스트리밍은 `playground.chat` 하나만.** 구조화 출력은 부분 파싱이 무의미하고, 서술·요약·계획은 카드 단위로 한 번에 뜨며, 도구 루프는 스텝 경계에서만 진행한다.

```ts
// src/lib/ai/runtime.ts (스케치)
const clients = new Map<string, OpenAICompatibleProvider>();

function providerFor(spec: ProviderSpec) {
  const key = `${spec.id}|${spec.baseURL}|${sha1(spec.apiKey!).slice(0, 8)}`;
  let p = clients.get(key);
  if (!p) {
    p = createOpenAICompatible({
      name: spec.id,
      baseURL: spec.baseURL!,
      apiKey: spec.apiKey!,
      headers: spec.headers?.(spec.apiKey!),
      supportsStructuredOutputs: spec.supportsStructuredOutputs,   // dist/index.d.ts:358
      includeUsage: true,                                          // :354
      fetch: meteredFetch,                                         // :350 — 유일한 훅 지점
    });
    clients.set(key, p);
  }
  return p;
}

// 폴백 체인 — 전체가 하나의 deadline 아래 있어야 한다
async function attemptChain<T>(meta: CallMeta, run: (m: ModelSpec) => Promise<T>) {
  const spec = TASKS[meta.task];
  const deadline = Date.now() + spec.timeoutMs;
  for (const tier of [spec.tier, spec.degradeTo].filter(Boolean) as Tier[]) {
    if (Date.now() >= deadline) break;          // ⚠ 남은 예산이 없으면 다음 시도를 건너뛴다
    try { return await run(pickModel(current(), tier, spec.needs).spec); }
    catch (e) {
      if (isAbort(e)) throw e;                  // ⚠ 취소는 폴백으로 삼키지 않는다
      await sleep(Math.random() * Math.min(8_000, 300 * 2 ** n));  // full jitter
    }
  }
  throw new AiGatewayError(...);
}
```

> ⚠ **재시도 2회 × 티어 폴백 2단 = 최악 6회 왕복.** 폴백 사슬은 AGENTS.md 가 명시한 요구사항(「키 없이도 앱이 뜬다」)이라 없앨 수 없으므로, 체인 **전체**를 `TASKS[task].timeoutMs` 하나의 deadline 아래 둔다. 이 규칙을 빼먹으면 이 설계가 개선이 아니라 회귀가 된다.

### 2.2 오케스트레이션

**현재 → 목표.** DAG 러너를 새로 만들지 않는다. `stage()`(`pipeline.ts:112-127`)를 그대로 두고 네 곳만 고친다.

| 자리                 | 현재                                                                                  | 목표                                                                    | 근거                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 파일 요약            | `for … await`(`summarize.ts:38-40`)                                                   | `Promise.all` (레인 세마포어 아래)                                      | 파일끼리 의존 없음. 바로 아래 `analyze.ts:70-72` 가 같은 집합을 이미 `Promise.all` 로 돈다                                  |
| `plan` ∥ `documents` | 직렬(`pipeline.ts:271`, `301`)                                                        | `Promise.allSettled`                                                    | plan 출력이 documents 인자에 안 들어간다                                                                                    |
| `documents` 내부     | `planDocuments` 먼저(`:303`), 그 뒤 `recallArtifacts`(`:307`)·`fillTemplates`(`:309`) | 셋을 `Promise.allSettled` 로. `recallArtifacts` 만 classify 성공에 의존 | 뒤 둘은 `planDocuments` 결과를 인자로 받지 않는다                                                                           |
| 서술자               | `await tell`(`:159,196,211,248,287,334`)                                              | 동시성 1 큐에 넣고 즉시 반환. 그래프 종료 후 8초 drain                  | 결과가 다음 단계의 입력이 아니다(`narrator.ts:93-99` 가 null 만 돌려준다). `apply/route.ts:269,300,333` 은 이미 `void tell` |

**취소.** `withTimeout` 은 `Promise.race` 라 240초 뒤에도 진 쪽이 계속 돈다. 필요한 것은 상한이 아니라 **좀비 회수**다.

```ts
// run/route.ts — cancel 을 달고 signal 을 내린다
const ctrl = new AbortController();
const stream = new ReadableStream({
  async start(controller) {
    await runStart(input, emit, { userId, signal: ctrl.signal });
  },
  cancel() {
    ctrl.abort("client-left");
  }, // ← 지금 없는 것
});
```

`stage()` 는 `AbortSignal.any([ctx.signal, AbortSignal.timeout(limitMs)])` 로 노드 신호를 합성해 `runObject`/`runText`/`waitForJob` 에 넘긴다. `AbortError` 는 `mark(id,"error")` 가 아니라 `"cancelled"` 로 별도 표기한다.

> **`/apply` 에는 취소를 붙이지 않는다.** 다만 그 판단의 근거였던 `session.ts:71-74` 가 지금 성립하지 않는다 — `saveApplyResult` 호출부가 0건이라 「제출해 놓고 기록 안 하는 상태」는 회피 대상이 아니라 현재 상태다. **순서를 뒤집는다: 먼저 서버 기록을 붙이고(§3 Step 0), 그 다음에 「기록이 남으니 안전하다」를 말한다.**

**취소 도입의 함정.** `abortSignal` 을 넣는 순간 12개 catch(`summarize.ts:101`, `analyze.ts:92`, `research.ts:200`, `reconcile.ts:94`, `intake.ts:147`, `prefill.ts:52` …)가 취소 예외를 「조용한 폴백」으로 오인해 취소된 실행이 열화된 결과를 정상처럼 저장한다. **취소 무브와 같은 커밋에 `if (isAbort(e)) throw e` 를 12곳에 넣는다.**

**신뢰 경계.** `runId` 는 서버가 만든다(`pipeline.ts:102`)는데 `apply/route.ts:77` 은 임의 문자열을 받고, 그것이 `artifactDir(runId)`(`file-agent.ts:447-449`)의 디렉터리 이름이 된다. `documents/route.ts:34,64-67` 도 마찬가지다.

```ts
// artifactDir — 탈출 불가로 만든다
export function artifactDir(runId: string): string {
  const base = join(tmpdir(), "antelope-artifacts");
  const dir = join(base, safeName(runId)); // 같은 모듈 :451 에 이미 있다
  if (relative(base, dir).startsWith("..")) throw new Error("runId");
  return dir;
}
// apply — path 를 클라이언트에서 받지 않는다
artifacts: z.array(z.object({ label: clamped(120), filename: clamped(200) }));
// 서버가 join(artifactDir(runId), safeName(filename)) 로 복원하고 존재를 확인한다
```

`run-registry.ts` 의 `Run` 에 `userId` 를 넣고 `hasRun(id, userId)` 로 바꾸면 `/steer`·`answer`·`/documents` 셋이 한 번에 닫힌다(각 라우트 1줄).

### 2.3 검증

**현재 → 목표**

|               | 현재                                     | 목표                                                          |
| ------------- | ---------------------------------------- | ------------------------------------------------------------- |
| 계약          | 12개 호출부에 손으로 복제                | `contract.ts` 의 `contractOf(schema, notes)` 가 zod 에서 파생 |
| 「JSON」 낱말 | 사람이 기억해서 넣는다                   | system 조립 첫 줄에 구조적으로 박힌다                         |
| 스키마 실패   | 즉시 폴백                                | `repairText`(문법 파손) → 계약 위반 재요청 1회 → 폴백         |
| 의미 검증     | 없음 (`plan.ts:103-113,126-129` 만 예외) | `verify.ts` 규칙 키트가 같은 복구 루프를 탄다                 |
| 제출          | `click` 이 제출 버튼도 그냥 누른다       | `submit` 도구 분리 + DOM 되읽기 대조 게이트                   |

**결정 1 — 검증은 스키마가 아니라 정규화·규칙이 한다.** `.nullish()` 남용은 실수가 아니라 정책이다(AGENTS.md 「구조화 출력의 함정」). 스키마를 조이라는 처방은 이 저장소에서 오답이다. 오히려 **풀어야 할 곳이 둘 있다** — `research.ts:219`·`reconcile.ts:20` 의 `label: z.string()` 은 필수라, 항목 20개 중 하나에 label 이 빠지면 배열 전체가 폐기되고 `research.ts:286-289` 의 평문 폴백으로 떨어진다. `.nullish()` 로 바꾸고 `makeNeed`(`needs.ts:28`)가 빈 라벨을 거르게 한다.

**결정 2 — 브라우저·정규식·화이트리스트가 답할 수 있으면 모델에게 묻지 않는다.** AGENTS.md 의 diagnose 교훈(HTML5 검증에 물어보기)을 추출 단계로 확장한 것이다.

```ts
// src/lib/ai/verify.ts
export type Issue = {
  path: string;
  code: string;
  message: string;
  severity: "drop" | "reject";
};

export const rules: {
  isoDate(path: string, o?: { future?: boolean }): Rule; // plan.ts:126-129 승격
  oneOf(path: string, allowed: readonly string[]): Rule; // plan.ts:103 · file-agent.ts:139 · isCategory 통합
  unitMatch(labelPath: string, valuePath: string): Rule; // 라벨의 (천원)·%·개월 과 값 자릿수 대조
  noPlaceholder(path: string): Rule; // needs.ts:30 정규식 승격
  uniqueBy(path: string, key: (i: unknown) => string): Rule; // normalizeKey 중복
};
export function documentClass(name: string): "obtain" | "author" | "unknown";
```

`unitMatch` 는 `playwright-agent.ts:711` 의 「총사업비 (천원)」 프롬프트 한 줄을 대체한다 — AGENTS.md 가 스스로 금지한 「케이스마다 프롬프트」 증식이 여기서 멈춘다.

**롤아웃**: 첫 배포에서는 `isoDate`·`oneOf`(이미 `plan.ts` 에서 운영 중인 규칙)만 강제하고, 새 규칙(`unitMatch`·`noPlaceholder`)은 로그 전용으로 둔 뒤 골든셋으로 오탐률을 보고 승격한다.

**결정 3 — 제출을 코드로 막는다.** 규칙 문장이 아니라 도구 구조로.

```
SNAPSHOT 에 한 줄 추가:
  isSubmit: el.type === 'submit' || /제출|신청하기|접수|완료|결제|납부/.test(label)

click 이 isSubmit 요소를 받으면 누르지 않고 "이 버튼은 submit 도구로만 누른다" 를 돌려준다.
  — click 은 [폼 밖] 링크를 이미 그렇게 막는다 (playwright-agent.ts:465-474)

새 도구 submit(ref) — allowSubmit === true 일 때만 tools 에 등록.
  /lab/notice 경로(allowSubmit false)는 코드 경로가 바뀌지 않아 데모가 안전하다.

  preflight: 스냅샷을 되읽어 각 입력의 현재 값을 꺼내고 normalizeKey(label) 로 facts 와 대조
    differs 나 diagnose blockers 가 있으면 → 누르지 않고 값 표를 문자열로 돌려준다
    통과 → submitGate(proposal) — apply 가 SSE `gate` 이벤트로 값 표를 띄우고 run-registry.ask 로 파킹
           대기 상한 2분 (초과하면 제출하지 않고 종료 — 제출 안 함이 안전한 실패)
           빈 항목 0 인 자동 신청 경로는 즉시 "go" 를 내되 proposal 을 trace·SSE 에 남긴다

  누른 뒤: /접수\s*(번호)?\s*[:：]?\s*([A-Za-z0-9-]{4,})|신청이?\s*(완료|접수)/ 로
           receipt: string|null, submitted: "yes"|"no"|"unknown" 을 반환값에 싣는다
```

`record()`(`playwright-agent.ts:190-200`)를 도구 예외 경로에서도 부른다 — 지금 `fill`(`:441`)·`click`(`:462`) 타임아웃은 trace 에도 SSE 에도 안 남는다.

### 2.4 컨텍스트

**현재 → 목표**

|               | 현재                                                           | 목표                                                   |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| 파일 파싱     | 같은 파일을 2~3회 (`summarize.ts:82`, `:109`, `analyze.ts:70`) | `ContextStore` 가 1회. `fileId` 재사용으로 업로드 제거 |
| parse 결과    | 길이만 재고 버림 (`summarize.ts:91-94`)                        | `store.setParsed()` 로 붙잡아 Solar 폴백의 재료로      |
| 단계 입력     | 각자 `clip` 상한을 손으로 정함 (8k/10k/12k/14k/30k)            | `store.view(kind)` — 표 하나                           |
| 절단 기록     | 없음                                                           | `meta.log("…에서 N자 잘림")`                           |
| 브라우저 루프 | 무한 누적                                                      | `prepareStep` — 최근 스냅샷 2장만 원문, 그 앞은 스텁   |

**브라우저 창 관리 — 이 축의 가장 큰 지렛대이고 의존이 없다.**

```ts
// playwright-agent.ts / agent.ts 의 generateText 에 한 필드 추가
prepareStep: ({ messages }) => ({
  messages: messages.map((m, i) =>
    isToolResult(m) && isSnapshot(m) && !inLastTwo(i)
      ? stub(m, "[이전 화면 — ref 는 무효다. 필요하면 read 를 다시 부른다]")
      : m),
}),
```

- 스냅샷 판별은 파서가 필요 없다 — `read()` 출력이 `URL:` 로 시작한다(`playwright-agent.ts:250-259`).
- v7 은 `messages` 오버라이드가 이후 스텝으로 이어진다고 명시한다(`dist/index.d.ts:1637`, `:4809`). 스텝마다 **창 밖으로 방금 밀려난 한 건만** 새로 치환되므로 앞쪽 접두는 바이트가 그대로 유지된다 — 프롬프트 캐싱과 공존한다.
- **건드리지 않는 것**: `click` 이 결과에 `read()` 를 붙이는 것(`:473`, 실측 근거 있음), 도구 직렬화 체인(`:580-594`), `checkValidity`/`validationMessage`(`:79-80`), `diagnose`(`:273-338`). 문제는 붙이는 것이 아니라 **오래된 것을 안 버리는 것**이다.

**프롬프트 캐싱은 측정 먼저.** 접두는 캐싱에 이상적이다 — system 1,822자와 초기 prompt 가 루프 시작 전에 문자열로 굳고(`:601` 의 `promptFor` 결과. `facts[label]` 대입·`artifacts.push` 가 나중에 일어나도 이 문자열은 안 바뀐다), 메시지는 append-only 다. 그런데 Upstage Solar 가 접두 캐싱을 하는지는 **문서로 확인되지 않았고 추측해서는 안 된다.** Step 1 의 계측이 `usage.prompt_tokens_details.cached_tokens` 를 기록하므로, 같은 접두로 두 번 호출하는 30분짜리 프로브 하나로 답이 나온다. 있으면 스텁 치환을 8스텝마다 일괄로 바꾸고, 없으면 접두 안정화만 유지한다(비용 0, Azure 로 돌리면 공짜로 켜진다).

### 2.5 관측

**현재 → 목표**

|           | 현재                                                                | 목표                                                                  |
| --------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 토큰·지연 | 0건                                                                 | 모든 왕복이 `ledger` 에                                               |
| 계측 지점 | 없음                                                                | `chatModel()` 의 `fetch` 훅 하나 — **호출부 21곳을 안 고치고 붙는다** |
| 실행 귀속 | 없음                                                                | `AsyncLocalStorage` 로 현재 task/runId 에                             |
| 헬스체크  | 설정을 읽어 보여줄 뿐 (`health/route.ts:54-62`, `ok: true` 는 상수) | 상류 도달성 프로브 + Studio 에이전트 접근성 + 최근 원장 요약          |
| 진단 표시 | `log` 이벤트를 화면이 버린다                                        | 접힌 진단 패널 + `stage` 이벤트에 `ms`                                |
| 감사 추적 | `trace` 를 apply 가 통째로 버린다                                   | `goals.snapshot` 에 저장                                              |

```ts
// src/lib/ai/meter.ts — 완전 투명해야 한다
export function meteredFetch(input, init) {
  const t0 = performance.now();
  return globalThis.fetch(input, init).then((res) => {
    try {
      // ⚠ body 를 직접 읽으면 /api/chat 의 스트리밍이 깨진다. clone 만 쓴다.
      res
        .clone()
        .json()
        .then((j) =>
          record({
            task: currentTask(),
            ms: performance.now() - t0,
            status: res.status,
            input: j?.usage?.prompt_tokens,
            output: j?.usage?.completion_tokens,
            cached: j?.usage?.prompt_tokens_details?.cached_tokens,
          }),
        )
        .catch(() => {});
    } catch {
      /* 훅은 어떤 경우에도 호출을 방해하지 않는다 */
    }
    return res;
  });
}
```

`/api/health` 에 더할 것: `ai: { provider, model, tier 표, reachable, latencyMs, studio: {notice, validation, analysis}, recent: ledger.summary(600_000) }`, 그리고 **자원 게이지** — `activeRuns`, `activeBrowsers`, `artifactDirBytes`, `desktopSessions`. 단일 실행 프로파일러만 만들면 이 시스템이 실제로 죽는 방식(동시 2건에서 Chromium OOM, tmpdir 고갈, `MAX_SESSIONS` 거절)은 안 잡힌다.

> `ok` 는 프로세스 생존만 뜻하게 유지하고 상류 실패는 `degraded: true` 로 별도 표기한다 — `railway.json:6` 의 healthcheck 가 이 응답을 보므로, 데모 중 상류 순단으로 롤백되면 안 된다.

---

## 3. 실행 순서

원칙 셋:

1. **각 단계 끝에서 데모가 돈다.** 어느 단계에서 멈춰도 그 시점이 이전보다 낫다.
2. **새 추상화는 측정 뒤에.** Step 0~6 은 새 계층을 만들지 않는다. Step 7 이 처음 만든다.
3. **호출부 이관은 한 번만.** 게이트웨이·계약·검증·컨텍스트를 각각 이관하면 같은 파일을 네 번 다시 쓴다.

3인 분담 제안 — Step 0~6 은 파일이 거의 안 겹쳐 병렬 가능하다: **A** = Step 1·8 (계측·취소), **B** = Step 2·5·6 (병렬화·DB·Studio), **C** = Step 0·3·4 (버그·브라우저·라우팅).

---

### Step 0 — 화면이 거짓말하는 곳과 죽은 코드 (S · 오늘)

**왜 이 순서인지**: 전부 한 줄~세 줄이고, 어느 리팩터에도 의존하지 않으며, 그중 하나는 기능이 통째로 없는 것이다. 대공사를 시작하기 전에 이것부터 없앤다.

| #   | 무엇                            | 파일:줄                                                                      | 고침                                                                                                                                                                                   |
| --- | ------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0-a | **캡챠 중도 전환 부활**         | `playwright-agent.ts:604-610`                                                | `captcha` 는 이미 `:216` 에서 클로저 변수에 채워진다. `generateText` 반환 직후 `if (captcha) return { ..., captcha }` — 3줄                                                            |
| 0-b | **성공을 성공이라고 말한다**    | `apply/route.ts:424` → `:428`                                                | `emit(agent done)` 두 줄을 `controller.close()` **앞으로**. 그리고 `start-flow.tsx` 가 `done` 수신 시 running 카드를 error 아닌 done 으로 내리게 (`settleCards` 는 예외 경로 전용으로) |
| 0-c | **신청 결과를 서버가 기록한다** | `apply/route.ts:379`(성공)·`:417`(실패)·`:421`(finally)                      | `saveApplyResult(userId, goalId, {...})` 호출. `session.ts:76` 은 이미 있다. `goalId`·`userId` 를 요청 본문·세션에서 받는다                                                            |
| 0-d | **서술형 기억 배선 연결**       | `pipeline.ts:316`, `apply/route.ts:291`                                      | `writeDocument` context 에 `userId` 추가. `file-agent.ts:175` 가 이미 받는다                                                                                                           |
| 0-e | **빈 키 와일드카드 차단**       | `file-agent.ts:120-124`                                                      | `keyed.filter((i) => i.key)` — 한 줄. (실측: `documentKey("제출 서류") === ""`)                                                                                                        |
| 0-f | **documents 스테이지 재배선**   | `pipeline.ts:303, 307, 309`                                                  | `Promise.allSettled([planDocuments, fillTemplates])`, `recallArtifacts` 는 classify 성공 시에만                                                                                        |
| 0-g | **runId 소유권**                | `run-registry.ts:17-23, 48, 62` + `steer/route.ts:37` + `documents/route.ts` | `Run` 에 `userId` 추가, `hasRun(id, userId)`, 각 라우트에서 세션 대조                                                                                                                  |
| 0-h | **경로 탈출 차단**              | `file-agent.ts:447-449`, `documents/route.ts:66`, `apply/route.ts:66-75`     | `safeName` 적용(`:451` 에 이미 있다) + `relative()` 검사 + `artifacts[].path` 를 요청 스키마에서 제거                                                                                  |
| 0-i | **artifactDir 청소**            | `apply/route.ts:432` 근처                                                    | `LINGER_MS` 뒤 `rm(dir, {recursive:true, force:true})`. 부팅 시 24시간 지난 것 일괄 정리                                                                                               |

**완료 판정**: 캡챠가 있는 데모 사이트에서 자동 모드로 시작 → 제출 후 캡챠 감지 → `mode: manual` 이벤트가 실제로 나가고 수동 브라우저가 뜬다. 캡챠 없는 사이트에서 정상 제출 → 브라우저 카드가 초록 done, `goals.result` 에 행이 남는다. `documentKey("제출 서류")` 케이스에서 사업계획서가 author 로 잡힌다.
**롤백**: 항목별 독립 커밋. `git revert` 하나씩.

---

### Step 1 — 계측 (S)

**왜 이 순서인지**: 이 문서의 절감 수치가 전부 추정이다. 무엇이 비싼지 모르는 상태에서 고른 최적화 대상은 대개 틀린다. 그리고 이건 **한 파일 두 줄**이다 — 신규 모듈 설계를 기다릴 이유가 없다.

무엇을:

- `src/lib/ai/meter.ts` — `meteredFetch` + `AsyncLocalStorage` 기반 `withLedger`
- `src/lib/ai/ledger.ts` — 링버퍼 512건 + `summary(windowMs)`
- `src/lib/llm.ts:98` — `createOpenAICompatible({..., includeUsage: true, fetch: meteredFetch})`
- `pipeline.ts:70` `runStart` 본문과 `apply/route.ts` 스트림 본문을 `withLedger` 로 감싼다
- `stage()`(`pipeline.ts:112-127`)가 `ms` 를 재서 `mark()` 에 싣고, `StartEvent` 의 `stage` 에 `ms?: number` 추가 → `agent-grid.tsx` 가 카드에 표시
- `start-flow.tsx` 에 `case "log"` 추가 + 접힌 진단 패널
- `/api/health` 에 `ai: ledger.summary(600_000)` + 자원 게이지
- 개발 모드에서 런 끝에 `console.table` 로 단계별 표

건드리는 파일: `src/lib/ai/{meter,ledger}.ts`(신규) · `src/lib/llm.ts` · `src/app/(app)/app/start/_lib/{pipeline.ts,types.ts,start-flow.tsx,agent-grid.tsx}` · `src/app/(app)/app/start/apply/route.ts` · `src/app/api/health/route.ts`

**완료 판정**: 준비 한 번을 돌리면 단계별 `{입력토큰, 출력토큰, ms}` 표가 나오고, `/api/health` 의 `ai.recent` 가 그 값을 보여준다. **§0.4 의 추정 두 개(43,000자 중복, 브라우저 누적)를 실측으로 갈아끼운다.** 스트리밍(`/api/chat`)이 여전히 정상 동작한다(clone 만 읽는지 확인).
**롤백**: `fetch: meteredFetch` 한 줄 제거.

**여기서 같이 답한다 — 한국어 프롬프트의 토큰 경제.** 고정 지시문이 전부 한국어이고(브라우저 system 1,822자 + 1,991자) 도구 루프에서 최대 60회 재전송된다. 한글은 UTF-8 3바이트/음절이라 한국어 특화 토크나이저가 아닌 곳에서는 바이트 BPE 로 떨어진다 — 즉 **`LLM_PROVIDER=azure|openai` 로 트랙을 바꾸는 순간(AGENTS.md 가 자랑하는 기능) 같은 프롬프트의 토큰 수가 뛴다.** 계측이 붙으면 의미가 같은 한/영 시스템 프롬프트를 각 트랙에 한 번씩 던져 `prompt_tokens` 를 비교하는 데 30분이면 된다. 이득이 확인되면 **지시문만 영어로, 출력·라벨은 한국어로** 두는 것이 가장 큰 단일 절감이 되고, 접두 캐싱과도 충돌하지 않는다.

---

### Step 2 — 직렬 병목 두 곳 병렬화 + 브라우저 레인 (S)

**왜 이 순서인지**: 요약 직렬은 런을 죽이는 유일한 병목이다(240초 스테이지 상한). 다만 병렬화는 Chromium 상한 없이 넣으면 OOM 을 새로 만든다 — 레인을 같은 커밋에 넣는다.

무엇을:

- `src/lib/ai/lanes.ts`(작은 파일) — `Semaphore` + `lanes.studio(3)` / `lanes.browser(2)`
- `summarize.ts:38-40` → `await Promise.all(intake.files.map((f) => lanes.studio(() => summarizeFile(f, ctx))))`. 페이지 루프(`:41-55`)도 같이
- `pipeline.ts:271`·`:301` → `const [plan, artifacts] = await Promise.all([stage("plan", …), stage("documents", …)])`
- `render/pdf.ts:15`·`probeCaptcha`·`runPlaywrightAgent`·`openSession` 을 `lanes.browser` 아래로
- `render/pdf.ts` 는 브라우저 인스턴스를 모듈 레벨에서 재사용(page 만 새로)

**완료 판정**: 파일 3개짜리 입력이 요약 스테이지에서 실패하지 않는다(이전에는 240초 초과로 런 종료). Step 1 원장에서 `summarize` 단계 ms 가 `Σ` 에서 `max` 로 바뀐다. 동시 실행 2건에서 `/api/health` 의 `activeBrowsers ≤ 2`.
**롤백**: `Promise.all` → `for await` 로 되돌린다. 레인은 남겨도 무해.

**기대 (추정)**: 파일 2 + 페이지 1 + 문서 2편 기준 준비 파이프라인 약 **-25~35%**. 실제 값은 Step 1 원장으로 확인.

---

### Step 3 — 브라우저 루프 컨텍스트 창 (M)

**왜 이 순서인지**: 단일 최대 지렛대이고 의존이 없다. `generateText` 인자 하나다.

무엇을: `playwright-agent.ts:596-602`·`agent.ts:327-330` 에 `prepareStep` 추가 (§2.4 스케치). 같이 v7 `timeout: {stepMs: 90_000, toolMs: 30_000}`(`dist/index.d.ts:597`)을 걸고 `onStepFinish` 로 스텝별 usage 를 ledger 에 넣는다.

**완료 판정**: 같은 신청 폼을 창 관리 on/off 로 각각 돌려 (a) 마지막 요청 입력 토큰이 크게 줄고, (b) **스텝 수가 늘지 않는다.** (b)가 지켜지지 않으면 스텁 문구를 조정하거나 보존 스냅샷을 3장으로 늘린다.
**롤백**: `AI_PREPARE_STEP=off` env 플래그로 즉시 끈다 (플래그를 처음부터 심는다).

**기대 (추정)**: 누적 입력이 O(n²) → O(n). 스냅샷 20장 기준 마지막 요청 116KB → ~12KB.

---

### Step 4 — 티어 라우팅과 서술자 (S)

무엇을:

- `env.ts` 에 `LLM_MODEL_SMALL`·`LLM_MODEL_NANO` optional 추가
- `start/_lib/llm.ts:10-15` → `chatModel(env.LLM_MODEL_SMALL ?? (provider === "upstage" ? "solar-mini" : undefined))`
- `narrator.ts:60` → `smallModel()`
- `pipeline.ts` 의 `tell` 6곳을 동시성 1 큐로 (`void`), 그래프 종료 후 8초 drain. `apply/route.ts` 의 `void tell` 셋도 같은 큐로 — 부수 효과로 `orchestrator` boolean 경합(`start-flow.tsx:201`)이 사라진다
- `narrate` prompt 를 `history.slice(-3)`(headline 만) + 400자 delta 로. `pipeline.ts:219` 의 brief 2,500자 투입 제거

**완료 판정**: Step 1 원장에서 `narrate` 가 big 모델 호출에서 사라지고, 카드 문구는 여전히 순서대로 도착한다. `LLM_PROVIDER=azure` + `LLM_MODEL_SMALL=<작은배포>` 로 띄웠을 때 intake/judge 가 작은 배포로 간다.
**롤백**: `narrator.ts:60` 을 `bigModel()` 로, 큐를 `await` 로.

**기대 (추정)**: big 모델 왕복 6회 제거 + 크리티컬 패스에서 ~24초.

---

### Step 5 — 지식베이스 조회 (S)

무엇을 (`lab/notice/_lib/memory.ts` — lab 파일 수정이므로 팀에 공지):

- `:120,131` → `ORDER BY labelEmbedding <=> $v ASC` + `WHERE labelEmbedding <=> $v < 0.5`. **임계값 0.50 의 의미는 그대로다** (코사인 거리 < 0.5 ⟺ 유사도 > 0.5)
- `:119-133` N+1 → **N개 서브쿼리 `UNION ALL`**. `unnest($1::vector[])` 은 drizzle+postgres.js 배열 바인딩이 검증되지 않았으므로 쓰지 않는다 — 평범한 vector 스칼라 N개면 바인딩 위험이 0이고 인덱스도 그대로 탄다
- `:96-101` 의 `select()` → 컬럼 목록 명시 (1024차원 벡터 두 벌을 행마다 끌어오지 않는다)
- `:150-178 recallNarratives` 에 유사도 하한 추가 — Step 0-d 로 이 경로가 **처음 활성화**되므로 반드시 같이
- `hub/page.tsx:19` 의 `graphEdges` 는 간선 수 상한과 노드 수 상한을 건다 (`memory.ts:232-239` 가 O(n²)×1024 를 요청마다)

**완료 판정**: 로컬에서 `EXPLAIN` 이 `Index Scan using memories_label_embedding_idx` 를 보여준다. 선채움 항목 20개의 DB 왕복이 1회.
**롤백**: 쿼리 형태만 되돌린다.

**실측 근거**: §0.2 — 5,000행 기준 17.902ms → 0.100ms.

---

### Step 6 — Studio 중복과 폴링 (M)

무엇을:

- `upstage-studio.ts:125-146 createJob` 이 `fileIds: string[]` 을 받게 (한 줄) → `analyze.ts:165-195`·`lab/analysis/ingest/route.ts` 의 raw fetch 복제 두 벌 삭제. **키 해석 규칙이 세 곳에 흩어져 있고 AGENTS.md 가 「이걸로 프로덕션이 한 번 죽었다」고 적은 값이다**
- `waitForJob`(`:149-187`)에 `signal` 추가 — 폴 `fetch`(`:167`)와 `setTimeout`(`:184`) 양쪽. 폴 GET 마다 `AbortSignal.timeout(10_000)`
- 폴링은 `include: "last"` 로 돌고 terminal 상태에서 **한 번만** `include=all` 로 다시 받는다 (`:164` 가 지금 90회 전부 좌표 포함 전체 스텝을 왕복시킨다). `waitForJob` 은 이미 `include` 를 받는다(`:154`)
- `runAgent`(`:190-200`)가 `timeoutMs`·`signal` 을 전달 (지금 통로 자체가 없어 요약이 180초 고정)
- `analyze.ts:70-72` — 이미 올린 파일은 `store.fileId` 재사용, 없는 것만 업로드
- `summarize.ts:91-94` — 버리던 `parsed.content.markdown` 을 붙잡아 Solar 폴백(`:109`)의 재파싱 제거
- `stepOutputs`(`:223-238`)의 빈 catch 둘 — raw 앞 200자를 로그에 남긴다
- `analyze.ts:39-56 fieldSchema` 에 `formName` 추가하고 `fillTemplates` 가 파일명 대신 그걸 쓴다

> ⚠ Studio Config 재프로비저닝은 **여기서 하지 않는다.** 이 단계는 호출 쪽만 고친다. Config 변경은 Step 10.

**완료 판정**: 파일 하나짜리 실행에서 `/v2/files` 업로드가 1회(이전 2회), Document Parse 페이지 과금이 절반. 폴링 응답 크기가 완료 1회를 뺀 나머지에서 급감(Step 1 원장의 fetch 바이트).
**롤백**: `include: "last"` 를 `"all"` 로 되돌린다.

---

### Step 7 — 게이트웨이와 호출부 이관 (L) — **여기서 처음 새 계층을 만든다**

**왜 이 순서인지**: Step 1~6 이 끝나면 무엇이 비싼지 데이터로 알고, 남은 것은 「횡단 관심사를 붙일 지점이 하나 없다」뿐이다. 그때 만든다.

무엇을:

1. `catalog.ts` + `tasks.ts` (선언만, 아무도 import 안 함)
2. `runtime.ts` + `gateway.ts` — Step 1 의 `meter.ts` 를 흡수. `contract.ts` 의 계약 렌더러와 복구 루프, `verify.ts` 훅, `ContextStore` 인자를 **처음부터 같은 게이트웨이 안에** 넣는다
3. `src/lib/llm.ts` 의 `chatModel`/`llmInfo` 를 게이트웨이 위 shim 으로 재구현 (시그니처 동일)
4. **호출부 이관 — 한 번만**, 3배치:
   - A: `start/_lib` 12곳 (`intake:129,158`, `summarize:134,182`, `research:162,236`, `analyze:105`, `reconcile:39`, `narrator:59`, `plan:54`, `file-agent:84,200`). 기존 `catch` 폴백은 **손대지 않는다** — 게이트웨이가 `AiGatewayError` 를 throw 하므로 그대로 동작한다. 이것이 마이그레이션 안전장치다
   - B: `lab/notice` 7곳 (`extract:101`, `agents:55,133,203,276`, `agent:327`, `playwright-agent:596`). lab 이 `src/lib` 을 **읽어서 쓰는 것**은 규칙 위반이 아니다
   - C: `api/chat:11`(runStream + 인증 게이트 + 길이 상한), `curator:50`(+ `clip(current, 12_000)` — `:65-72` 가 지금 지식 전량을 무제한으로 싣는다)
5. 배치 A 가 **완전히 끝난 커밋에서만** `start/_lib/llm.ts` 의 `smallModel`/`bigModel` 삭제 (`clip` 만 남긴다)

**완료 판정**: `grep -rn "generateObject(\|generateText(\|streamText(" src/` 가 `src/lib/ai/` 안으로만 나온다. 준비 한 번의 원장에 모든 호출이 `task` 이름으로 잡힌다. Upstage 트랙에서 나가는 HTTP 요청 본문이 이관 전과 동일하다(`supportsStructuredOutputs: false` 유지 — 회귀 없음의 검증 기준).
**롤백**: 배치 단위 revert. 어느 배치에서 멈춰도 나머지는 shim 으로 돈다.

---

### Step 8 — 취소 (M)

무엇을: `run/route.ts:59` 에 `cancel()` + `AbortController`, `Ctx` 에 `signal`, `stage()` 가 `AbortSignal.any([signal, timeout])` 합성, `runObject`/`runText`/`waitForJob` 에 전달. **같은 커밋에** 12개 catch 에 `if (isAbort(e)) throw e`. `AbortError` 는 `"cancelled"` 로 마크.

`/apply` 는 붙이지 않는다 — Step 0-c 로 서버 기록이 붙은 뒤에도 제출 부작용은 되돌릴 수 없다.

**완료 판정**: 준비 중 탭을 닫으면 서버 로그에서 Studio 폴링·Solar 호출이 즉시 멈춘다. 원장의 「떠난 실행」 토큰이 0.
**롤백**: `cancel()` 제거.

---

### Step 9 — 계약과 검증 (M)

무엇을: `contract.ts`(zod → 계약 문자열, `z.toJSONSchema(schema, {io:"output", unrepresentable:"any"})` 를 TS 리터럴로 렌더 — zod 4.4.3 이 `.nullish()` 를 `anyOf:[T,null]` 로 내므로 `T | null` 로 되접는다) + `verify.ts` 규칙 키트 + 복구 루프 1회. `research.ts:219`·`reconcile.ts:20` 의 `label: z.string()` 을 `.nullish()` 로 **푼다**. `judge`(`summarize.ts:198-208`)의 enum 을 문자열로 풀고 normalize 로 접되 catch 는 `"unknown"` 을 낸다. §2.3 의 제출 게이트.

**수용 기준(첫 이관)**: `contractOf(extractionSchema)` 결과가 현재 `extract.ts:88-99` 의 `FIELD_CONTRACT` 와 의미적으로 같은가.
**롤백**: `repair: 0` + `verify: undefined` 로 게이트웨이 옵션만 끈다.

---

### Step 10 — 근거 (M · 데모 후, 플래그 뒤)

무엇을: `lab/notice/_lib/evidence.ts` → `src/lib/grounding.ts` 승격(원 위치에 re-export 한 줄). 짧은 needle(8자 미만) 게이트 — `containment`(`evidence.ts:67-72`)가 대상 길이로 정규화하지 않아 5글자 서류명이 긴 문단에 우연히 맞는다. `queries()`(`:120-134`)에 금액 표기 추가. 두 `workflow.ts` 를 `src/lib/workflows/` 로 승격하고 `coordinates: true` 를 켠다. `analyze()` 가 parse 스텝 → `toEvidence` → 스냅샷까지 잇는다.

> ⚠ **Config 는 불변이라 새 `agentId` 가 생긴다.** 기존 `UPSTAGE_ANALYSIS_AGENT_ID` 를 그대로 둔 채 로컬에서 새 ID 로 검증한 뒤 Railway 변수를 교체한다. **데모 D-day 에는 교체하지 않는다.**
> 1단계는 **배지 표시만**(강등 없음) — 「빈 항목 0 이면 사람 없이 바로 신청」이 이 제품의 데모 하이라이트이고, 강등 규칙이 하나라도 오탐하면 그게 꺼진다. 강등은 `AI_GROUNDING_GATE=on` 뒤에 둔다.

---

### Step 11 — 골든셋 (M · 데모 후)

**순수 함수부터.** LLM 없이 결정론적으로 돌고 임계값 회귀를 바로 잡는다:
`normalize()`(`lab/notice/_lib/schema.ts`) · `makeNeed()`(`needs.ts:18`) · `documentKey()`(`documents.ts:19`) · `mergeNeeds()`(`needs.ts:66`) · `matchEvidence()`(`evidence.ts:91`) · `documentClass()`(신규).

`evals/score.ts` 의 점수 함수(가중 F1, obtain→author 오분류에 5배 가중, 「같은 걸 두 번 묻는가」 = normalizeKey 중복쌍 수)는 순수 함수라 지금도 쓸 수 있다. LLM 케이스와 fixture 재생은 Step 1 의 `fetch` 훅이 녹화까지 하게 확장한 뒤. **CI 에는 붙이지 않는다** — 키·비용·시간 때문이고, 3인이 같은 방에 있는 팀에서 게이트를 늘리는 것이 순손실이라는 저장소 판단(AGENTS.md 「CI / PR 리뷰」)과 일관된다.

---

### 데모 프리즈 규칙

D-day 전 **72시간** 동안 건드리지 않는다:

- `UPSTAGE_*_AGENT_ID` (Step 10)
- `StartEvent`/`ApplyEvent` 스키마와 `start-flow.tsx` 의 SSE 파서
- `allowSubmit` 경로의 도구 목록

### 킬스위치 (Step 1 과 함께 심는다)

`AI_PREPARE_STEP` · `AI_TIER_ROUTING` · `AI_REPAIR` · `AI_GROUNDING_GATE` · `LLM_STRUCTURED_OUTPUTS`. `env.ts:67` 은 import 시점에 한 번만 parse 하므로 런타임 토글은 안 되지만, 배포 변수 하나로 끄는 것은 된다 — 데모 당일 회귀를 5분 안에 되돌린다.

---

## 4. 측정

### 왜 계측이 먼저인가

§0.4 의 두 숫자(준비 43,000자 중복, 브라우저 누적 1.2MB)는 **코드에 박힌 상수로 계산한 추정**이다. 한국어 문자↔토큰 비율은 프로바이더마다 다르고 우리는 그 비율조차 모른다. 계측 없이 Step 2~6 을 하면 개선했다는 말을 할 수 없고, 틀린 대상을 골랐는지도 모른다. 그리고 계측 자체가 `src/lib/llm.ts:98` 두 줄이다 — 미룰 이유가 없다.

### 무엇을 비교하는가

| 지표                               | 어떻게                                                                 | 언제                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 준비 실행 총 입력·출력 토큰        | `ledger.summary()` — 단계별 분해                                       | Step 1 직후 baseline, Step 2·4·6 뒤                                       |
| 준비 wall-clock, 단계별 ms         | `stage` 이벤트의 `ms`                                                  | 매 스텝                                                                   |
| 신청 루프 누적 입력 토큰 / 스텝 수 | `onStepFinish` 스텝별 usage                                            | Step 3 전후 (스텝 수가 **늘지 않는지**가 수용 기준)                       |
| `cached_tokens` 존재 여부          | 같은 접두로 2회 호출하는 30분 프로브                                   | Step 1 직후, upstage·azure 각각                                           |
| 한/영 프롬프트 토큰비              | 의미가 같은 두 system 을 각 트랙에 1회씩                               | Step 1 직후                                                               |
| Document Parse 페이지 수           | Upstage 콘솔 + `/api/document` 의 `usage.pages`                        | Step 6 전후                                                               |
| 선채움 DB 왕복 수·실행계획         | `EXPLAIN (ANALYZE)`                                                    | Step 5 전후 (§0.2 방식 그대로)                                            |
| 폴백 발동률 (`degraded`)           | 원장                                                                   | Step 7 이후 상시                                                          |
| 동시 자원                          | `/api/health` 의 `activeBrowsers`·`artifactDirBytes`·`desktopSessions` | Step 2 이후 — **동시 준비 2건 + 신청 1건** 수동 시나리오를 데모 전 체크로 |
| 정확도 회귀                        | `evals` 점수 vs `baseline.json`                                        | Step 11 이후, 프롬프트·임계값을 만질 때                                   |

### 목표 수치

절대값은 Step 1 이 baseline 을 만든 뒤에 확정한다. 지금 세울 수 있는 것은 상대 목표와 **불변식**이다.

**상대 목표 (baseline 대비)**

- 준비 파이프라인 입력 토큰 **-35% 이상** (Step 4 서술자 + Step 7 계층 뷰)
- 준비 wall-clock **-30% 이상** (Step 2 병렬화 + Step 4 서술자 비동기)
- 신청 루프 누적 입력 토큰 **-60% 이상** (Step 3), 스텝 수 증가 **0**
- Document Parse 과금 페이지 **-50%** (Step 6 — 파일당 2회 → 1회)
- 선채움 DB 왕복 20 → 1, 조회 계획이 `Index Scan` (Step 5)

**불변식 (하나라도 깨지면 그 단계는 롤백)**

- 파일 3개짜리 입력이 요약 스테이지에서 실패하지 않는다
- `via` 필드가 화면에 그대로 보고된다 (폴백 가시성은 명시적 요구사항)
- `UPSTAGE_*` 키·에이전트 ID 를 전부 비워도 앱이 뜨고 Solar/휴리스틱으로 끝까지 간다
- 캡챠 있는 사이트에서 수동 모드로 전환된다
- 성공한 신청이 화면에 성공으로 표시되고 `goals.result` 에 남는다
- 임계값 0.50 / 0.6 / 0.5 의 **의미**가 바뀌지 않는다

---

## 5. 하지 않을 것

| 검토했으나 버린 것                                          | 이유                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LangChain / LangGraph 등 오케스트레이션 프레임워크 도입** | AI SDK v7 이 이미 `prepareStep`·`timeout`·`abortSignal`·`repairText`·`wrapLanguageModel`·`embedMany(maxParallelCalls)` 를 전부 준다(전수 확인). 이 저장소가 안 쓰고 있을 뿐이다. 프레임워크를 얹으면 `serverExternalPackages`(`next.config.ts:8`)·standalone 트레이싱·Dockerfile 복사 목록이 또 한 겹 늘어난다 — Playwright·`@rhwp/core` 로 이미 두 번 밟은 자리다                                                                                                                                   |
| **`src/lib/flow/` DAG 러너 신설**                           | 단계 단위 횡단 지점은 `pipeline.ts:112-127` 의 `stage()` + `withTimeout` 으로 이미 있고 이벤트 배선(`mark`/`emit`)도 붙어 있다. 없는 것은 모델 호출 단위 지점 하나뿐이고 그건 `chatModel()` 두 줄이다. 8단계 → 12노드 재배선이 실제로 사는 것은 `Promise.all` 두 군데인데, 그건 Step 2 가 이미 한다                                                                                                                                                                                                  |
| **게이트웨이·러너·structured·컨텍스트스토어를 각각 신설**   | 넷 다 호출부와 모델 사이 같은 자리에 앉는다. 넷을 병렬로 만들면 같은 8개 파일(≈1,900줄)을 네 번 다시 쓰고, 3인이 같은 `main` 에 직접 푸시하는 저장소에서 리베이스 충돌이 전면전이 된다. 래퍼는 하나, 호출부 이관은 한 번                                                                                                                                                                                                                                                                             |
| **노드 단위 체크포인트와 재개 (L)**                         | 재개가 실제로 재개가 아니다 — 산출물 경로가 tmpdir(`file-agent.ts:447-449`)이라 재시작 후 무효고, `SessionSnapshot.stages`(`types.ts:204`)를 읽는 코드가 없으며(`grep "\.stages"` = 0건), Studio 파일 보존 기간은 확인된 바 없다. **살리는 부분은 S 로 잘라 Step 0 옆에 둔다**: goals 행을 `intake` 직후 만들고 단계마다 갱신 — 사후 진단(「왜 못 했는지」)이라는 실질 가치의 대부분이 거기서 나온다                                                                                                 |
| **apply 를 그래프에 흡수 + 이벤트 스키마 통합 + 어댑터**    | 데모를 깨는 가장 큰 두 무브다. `allowSubmit: true` 로 실제 접수를 하고, 클라이언트(`start-flow.tsx`, 873줄)의 이벤트 switch·SSE 파서·`settleCards`·자동신청 분기가 전부 현재 어휘에 묶여 있다. 「어댑터로 데모를 지킨다」는 발상은 옳지만 어댑터 자체가 M 규모 신규 코드라 **안전판을 만드느라 위험을 새로 만든다.** 노린 이득 둘(왕복 페이로드, makeFile 의 userId)은 각각 Step 0-d 와 Step 8 이 한 줄로 해결한다                                                                                   |
| **`site_playbooks` 절차 기억 (L)**                          | 신규 테이블 + 프로덕션 `db:push` + trace 정규화 + 프롬프트 주입 + 실패 카운터 무효화. 효과가 「같은 사이트 두 번째 신청」에만 나오는데 데모에서 그 시나리오가 실행될 확률이 낮다. **안에 섞인 S 하나만 살린다** — `trace` 를 `goals.snapshot` 에 저장(Step 0-c 와 같은 커밋). 사용자 명의 접수의 감사 추적은 데모 전에 있어야 한다                                                                                                                                                                   |
| **`documents.write` 스트리밍**                              | UI 계약(새 이벤트 타입 + 카드 내부 렌더)을 바꾸면서 실제 wall-clock 은 안 줄인다. 같은 「멈춘 것처럼 보임」을 `pipeline.ts:312-330` 의 문서 루프 병렬화로 실제 시간을 줄여 해결한다 — UI 변경 0                                                                                                                                                                                                                                                                                                      |
| **자기 일관성 투표(vote)를 널리 도입**                      | 출력이 2진값이고 입력이 세 번 다 같으며 실패 비용이 비대칭인 자리는 `judge`(`summarize.ts:182`) 하나뿐이다. 서술·요약·문서 작성은 출력이 길어 다수결이 성립하지 않고, 브라우저 루프는 스텝 단위라 불가능하며, 나머지 추출은 결정론적 폴백이 이미 있어 3배 비용보다 폴백+복구가 싸다                                                                                                                                                                                                                  |
| **Upstage 트랙에 `supportsStructuredOutputs: true`**        | 요청 본문이 `json_object` → `json_schema` 로 바뀌는데 **한 번도 그 경로로 나가 본 적이 없다.** 데모 경로의 바이트를 이전과 동일하게 유지하는 것이 회귀 없음의 유일한 검증 기준이다. OpenAI/Azure 에서만 켜고 킬스위치를 둔다                                                                                                                                                                                                                                                                         |
| **프롬프트를 별도 디렉터리로 이전**                         | Upstage 가 zod 를 모델에 안 넘기므로 프롬프트의 필드 계약이 사실상 스키마의 쌍둥이다 — 다른 파일로 갈라 놓으면 한쪽만 고치는 사고가 정확히 두 배가 된다. `lab/*` 의 프롬프트를 `src/lib` 로 옮기는 것은 「실험은 자기 폴더 안에만」 규칙 위반이고, 3인이 같은 `main` 을 쓰는데 전부 한 디렉터리에 모으면 충돌 지점을 인위적으로 만든다. **뽑는 것은 축자 중복뿐** — `research.ts:243` ≡ `reconcile.ts:46`, `research.ts:249` ≈ `reconcile.ts:52`, `agent.ts:360-364` ≡ `playwright-agent.ts:717-721` |
| **`embedding_cache` 테이블**                                | 두 번째 실행부터만 이득이라 데모에서 안 보인다. Step 5 의 인덱스 교정이 같은 문제의 90%를 잡는다                                                                                                                                                                                                                                                                                                                                                                                                     |
| **`unnest($1::vector[])` 로 N+1 접기**                      | drizzle + postgres.js 의 `vector[]` 배열 바인딩(원소 캐스팅·배열 리터럴 인코딩)이 검증되지 않았다. 실패하면 이 무브 하나가 하루를 먹는다. `UNION ALL` 은 파라미터가 평범한 스칼라 N개라 위험이 0이고 인덱스도 그대로 탄다                                                                                                                                                                                                                                                                            |
| **`maxDuration` 값 조정**                                   | Railway standalone 에서 강제되지 않는다(`next.config.ts:4` + Dockerfile `CMD ["node","server.js"]`, `railway.json` 에 timeout 없음). 600·900·240·180·120·60 은 전부 의도 표명이지 강제가 아니다. 실제 상한은 `STAGE_TIMEOUT_MS`·`ANSWER_TIMEOUT_MS`·프록시 유휴(하트비트가 막는다)·컨테이너 메모리다                                                                                                                                                                                                 |
| **`/apply` 에 취소 붙이기**                                 | 제출 부작용은 되돌릴 수 없다. 붙일 자리는 부작용이 없는 준비 단계뿐                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **`stage()` 의 「실패해도 다음으로」 정책 변경**            | 버그가 아니라 선언된 정책이다(`pipeline.ts:33-35`). 고칠 대상은 정책이 아니라 **부분 실패가 남기는 쓰레기** — `documents` 순서(Step 0-f), `research` 실패 시 `APPLY_URL_KEY` 소실(`research.ts:98-109` 이 함수 안에 있어 던지면 사라진다), 화면이 그 사실을 안 보여주는 것(Step 1 의 `log` 패널)                                                                                                                                                                                                     |
| **임계값 상수 조정**                                        | 0.50(`memory.ts:31`) · 0.6(`evidence.ts:81`) · 0.5 하한(`reconcile.ts:82`) · 0.03/0.35(changeRatio) 전부 실측으로 고른 값이다. 이 개편의 어느 단계도 이 값들을 건드릴 이유가 없다 — 명시적으로 범위 밖에 둔다. 재작성이 필요한 자리(Step 5 의 SQL)에서도 **의미를 보존한 채** 형태만 바꾼다                                                                                                                                                                                                          |

---

### 착수 0순위 요약

대공사가 아니다. 오늘 머지할 수 있는 것들이다.

1. `playwright-agent.ts:604-610` — `if (captcha) return {..., captcha}` **3줄.** 이 저장소에서 유일하게 기능이 통째로 없는 결함이다.
2. `apply/route.ts:424→428` — emit 을 close 앞으로. **2줄.** 성공한 신청을 실패로 표시하는 것은 데모에서 가장 비싼 거짓말이다.
3. `apply/route.ts` 세 경로에 `saveApplyResult` 호출. **3줄.** 사용자 명의 접수의 서버 기록이 지금 없다.
4. `pipeline.ts:316` · `apply/route.ts:291` 에 `userId` 인자. **2줄.** 「이 제품의 해자」가 이걸로 처음 켜진다.
5. `file-agent.ts:120` 에 `.filter((i) => i.key)`. **1줄.**
6. `src/lib/llm.ts:98` 에 `fetch` 훅 + `includeUsage: true`. **2줄.** 이후 모든 우선순위의 근거.

---

## 6. 실행 기록 (2026-08-22)

계획의 Step 0~11 을 전부 반영했다. 커밋 11개, `src` 기준 +4,371 / −937.
매 커밋에서 `pnpm typecheck` · `pnpm lint` · `pnpm build` 가 통과한다.

| 커밋      | 무엇                                                       |
| --------- | ---------------------------------------------------------- |
| `264c97d` | 기능이 통째로 없던 자리 넷 + 신뢰 경계 + tmpdir 청소       |
| `aefe00d` | 계측 — 모든 모델 왕복을 원장에                             |
| `57c9979` | 직렬 두 구간 병렬화 + Chromium 레인                        |
| `de9466d` | 브라우저 루프 컨텍스트 창(`prepareStep`)                   |
| `26f3023` | 티어 표 + 서술자를 크리티컬 패스 밖으로                    |
| `a457453` | pgvector 인덱스 교정 + N+1 → `UNION ALL`                   |
| `a9c985d` | Studio 중복 업로드·파싱 제거, 폴링 경량화, job 생성 일원화 |
| `5526b4d` | 게이트웨이 · 계약 · 검증 · 취소                            |
| `e3bf4cc` | 제출 게이트 — 규칙이 아니라 도구 구조로                    |
| `e53a739` | 근거 하이라이트를 프로덕션 경로로                          |
| `5877402` | 골든셋 34개 (`pnpm eval`)                                  |

### 계획에서 달라진 것

**Xvfb 세션을 브라우저 레인에 넣지 않았다.** 계획은 넣으라고 했지만, 그
세션은 함수가 끝난 뒤에도 최대 15분 살아 있다 — 레인을 잡고 있으면 다음
신청이 「거절」이 아니라 **무한 대기**가 된다. 지금의 즉시 거절
(`MAX_SESSIONS = 2`)이 낫다. 합쳐서 최악 4개다.

**검증을 정규화 **뒤**가 아니라 앞에서 돌린다.** 계획은 `Out` 위에서 규칙을
돌리게 했는데, 그러면 `drop` 을 누가 적용하는지가 모호해진다. 원본 위에서
돌리고 `normalize(raw, issues)` 가 `dropped()` 로 물어 정하게 바꿨다 — 무엇을
버릴지는 자리마다 다르다(마감은 null 로, 항목은 배열에서 빠짐).

**계약 렌더러의 배열 깊이.** 처음 구현이 배열을 중첩 레벨로 세어
`[{ "label": …, … }]` 처럼 원소 필드를 통째로 생략했다. 배열은 컨테이너지
레벨이 아니다. 이 회귀를 `evals/verify.test.ts` 가 지킨다.

### 측정으로 확인한 것

- **pgvector**: 새 형태는 `Index Scan using memories_label_embedding_idx`,
  예전 형태는 `enable_seqscan = off` 로도 Seq Scan(플래너가 「Disabled: true」를
  달고도 그걸 고른다 = 인덱스를 **쓸 수 없다**). 5,000행 17.902ms → 0.100ms.
- **UNION ALL 조회**: 로컬 DB 로 확인. 「상시근로자 수」→「현재 직원 수」 하나만
  오고, 하한 아래인 질의는 빈 채로 온다.
- **계약 파생**: 손으로 쓰던 문장과 같은 모양이 나온다
  (`{ "needs": [{ "label": string | null, "kind": "text"|… }] | null }`).
- **컨텍스트 창**: 최근 두 장만 남고 원본 배열은 변형되지 않는다.

### 남은 것

**토큰 절감치는 아직 추정이다.** §0.4 의 두 숫자(준비 43,000자 중복, 브라우저
누적 1.2MB)를 실측으로 갈아끼우려면 **키를 넣고 준비를 한 번 돌려야** 한다.
계측은 붙었으니 `/api/health` 의 `ai.byTask` 와 개발 콘솔의 `console.table` 이
그 자리에서 답한다.

같이 붙는 30분짜리 프로브 둘도 아직 안 돌렸다 — `cached_tokens` 가 오는지,
그리고 한/영 시스템 프롬프트의 `prompt_tokens` 비. 후자는 트랙 스위칭이 이
제품의 간판인데 그 스위치가 비용에 무슨 짓을 하는지 지금 아무도 모른다.

**Studio Config 재프로비저닝이 남았다.** `coordinates: true` 를 켠 Config 는
새 Agent ID 를 만든다. 로컬에서 검증한 뒤 Railway 변수를 교체한다 —
**데모 당일에는 하지 않는다.**
