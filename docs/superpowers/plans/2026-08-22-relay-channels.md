# 릴레이 채널 — 슬랙·텔레그램에서 에이전트를 돌린다

> **근거 표기 규칙**
>
> - **코드** — `4932690` + 현재 워킹트리 기준으로 **직접 열어 확인했다.** 줄번호를 단 주장은 전부 이쪽이다.
> - **외부** — 슬랙·텔레그램 API 의 동작은 공식 문서에 대한 기억이고 **이 문서를 쓰면서 호출해 본 적이 없다.** 「미검증」으로 표시한다. Step 0 이 전부 실측으로 갈아끼운다.
> - 두 종류를 섞지 않는다. 미검증 항목 위에 설계를 세우되, 그것이 틀렸을 때 어디가 무너지는지 같이 적는다.

---

## 0. 무엇을 만드는가

한 문장: **에이전트를 「탭이 열려 있는 동안 도는 것」에서 「스레드에서 며칠에 걸쳐 도는 것」으로 옮긴다.**

```
슬랙 스레드                                     텔레그램 채팅
─────────────                                  ────────────
@antelope 이 공고 신청 준비해줘  [공고.pdf]      /start 로 연동한 봇에 같은 요청
  └ 진행 상황이 댓글로 쌓인다                      └ 같은 이벤트가 메시지 편집으로
  └ 막히면 @원요청자 를 멘션해 자료를 요청           └ 막히면 답장으로 요청
  └ 답장/파일 첨부 → 그 자리에서 이어서 진행         └ 같음
```

「사용자가 세션을 열어 놓고 기다릴 수 없다」가 이 기능의 존재 이유다. 현재 준비 파이프라인은 8단계이고 Studio job 하나가 45~180초(`src/lib/upstage-studio.ts:158`), 신청은 최대 60스텝이다(`apply/route.ts:368`). 사람이 그 앞에 앉아 있어야 한다는 전제가 제품을 작게 만든다.

### 이 기능이 곁가지가 아닌 이유

같은 저장소에서 진행 중인 [LLM 계층 개편](./2026-08-22-llm-layer-rearchitecture.md) 이 지적한 결함 셋은 **원인이 하나다** — 실행이 클라이언트 수명에 묶여 있다.

| 개편 문서가 지적한 것                                                                                        | 이 문서와의 관계                                                           |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `saveApplyResult`(`_lib/session.ts:76`) 호출부 0건, 실제 저장은 클라이언트 `start-flow.tsx:446-457` 의 PATCH | 릴레이에는 클라이언트가 없다. 서버가 쓰지 않으면 **아무 데도 안 남는다**   |
| 성공한 신청이 화면에서 빨간 「연결이 끊겨 중단됐다」로 끝난다                                                | 릴레이는 종료 사유를 스레드에 글자로 쓴다. 거짓말할 여지가 구조적으로 없다 |
| 준비 결과를 클라이언트가 들고 있다가 `/apply` 본문으로 되돌려 보낸다                                         | 이 문서 §1-A 가 정면으로 다루는 그 문제다                                  |

즉 릴레이는 개편과 **경쟁하지 않는다.** 개편이 「모델 호출 한 번」을 정돈하는 동안, 릴레이는 「실행 한 건의 수명」을 정돈한다. 겹치는 파일은 두 개뿐이고 §6 에서 따로 다룬다.

---

## 1. 왜 지금 안 되는가 — 막는 것 일곱

### A. 준비와 신청 사이의 상태를 **클라이언트가 들고 있다** ★ 가장 큰 벽

`/apply` 는 준비 결과를 요청 본문으로 되받는다.

```
apply/route.ts:38-118  body 스키마: applyUrl · title · facts · plan · artifacts
                       · runId · sessionId · needs · brief · organization
                       · deadline · narration
start-flow.tsx:396-404 클라이언트가 그것을 조립해 POST 한다
start-flow.tsx:325-345 「빈 필수 항목이 0 이고 URL 이 있으면 바로 신청」이라는
                       판단도 클라이언트 useEffect 안에 있다
```

슬랙에는 이 클라이언트가 없다. 세 가지 길이 있다.

| 길                                                                  | 평가                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 릴레이가 loopback 으로 `/app/start/apply` 를 HTTP 호출              | ❌ 인증 쿠키가 없다. `src/proxy.ts:53` matcher 가 `/app/:path*` 를 DB 세션까지 검증해 막는다                                                                                                                                            |
| `goals.snapshot` 에서 apply 인자를 재조립                           | △ 가능하다 — `SessionSnapshot`(`_lib/types.ts:186-207`)에 `applyUrl·needs·plan·artifacts·brief` 가 다 있다. 단 `narration` 은 없고, `artifacts[].path` 는 컨테이너 tmpdir 경로라 재배포하면 무효(`types.ts:154-158` 이 그렇게 못박는다) |
| **apply 본문을 함수로 뽑아 `runStart` 와 같은 프로세스에서 잇는다** | ✅ 옳다. 단 `apply/route.ts` 의 실행 로직은 `POST` 안에 `:163`부터 `:519`까지 인라인이고, 개편 문서 Step 0-b·0-c 가 **정확히 그 줄들을 건드린다**                                                                                       |

→ **결론: 단계를 가른다.** 1단계는 준비까지만 스레드에서 완주하고 신청은 `/app` 링크로 넘긴다. 신청까지 서버에서 잇는 것은 개편 Step 0 이 끝난 뒤 5단계로 미룬다(§5).

### B. 실행을 시작하는 것이 HTTP 요청뿐이다

`run/route.ts:59-99` 가 `ReadableStream.start` 안에서 `runStart` 를 await 한다. 트리거가 곧 스트림이다.

다행히 **`runStart` 는 이미 호스트에서 자유롭다**:

```ts
// _lib/pipeline.ts:42, 72-76
type Emit = (event: StartEvent) => void;
export async function runStart(
  input: IntakeInput, // { text?, url?, file? }  — intake.ts:17
  emit: Emit,
  opts: { userId: string | null },
): Promise<void>;
```

`emit` 이 이미 함수 인자다. **SSE 를 스레드 댓글로 바꾸는 데 필요한 것은 이 함수 하나를 갈아끼우는 것이 전부다.** 이 사실이 이 기능 전체의 전제다.

### C. 되묻기가 두 갈래인데 한쪽만 채널로 옮길 수 있다

| 어디                         | 지금                                                                                                                     | 채널에서                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **준비 단계** — 빈 필수 항목 | 사람에게 안 묻는다. `emit({type:"needs"})`(`types.ts:230-237`) 를 받아 화면이 Drawer 폼으로 그린다(`start-flow.tsx:619`) | 스레드 질문으로 바꿔야 한다. **파이프라인이 이미 끝난 뒤**(`end: ready`)라 시간 제약이 없다 |
| **신청 도중** — 폼에 없던 값 | `ask()`(`run-registry.ts:66-90`) 가 실행을 파킹하고 기다린다                                                             | 15분 상한이 걸린다(다음 항목)                                                               |

### D. 대기 상태가 프로세스 메모리에 있고 15분이면 끊긴다

```
run-registry.ts:26   const runs = new Map<string, Run>();
run-registry.ts:36   const ANSWER_TIMEOUT_MS = 15 * 60 * 1000;
run-registry.ts:8    주석: "프로세스 메모리에 둔다. 인스턴스가 하나라 충분하고"
```

15분은 **화면 앞에 앉은 사람** 기준으로 고른 값이고, 그 근거는 파일의 주석에 정확히 적혀 있다 — 없으면 Chromium·Xvfb 가 영원히 남는다. 슬랙 사용자는 퇴근하고 답한다.

→ **이 값을 늘리지 않는다.** 늘리면 그 주석이 막으려던 자원 누수가 그대로 돌아온다. 대신 15분이 지나면 실행을 **접고**, 스레드에 「받은 값으로 다시 이어서 하기」 링크를 남긴다. 준비 단계 되묻기(C)는 애초에 이 경로를 안 타므로 무제한이다.

### E. 재배포 한 번이면 진행 중인 실행이 전멸한다

`runs` 가 프로세스 Map 이고 실행 자체도 프로세스 안에 있다. `main` 푸시 → Railway 자동 배포 → 진행 중이던 모든 스레드가 조용히 죽는다. 해커톤 기간에 확실히 일어난다.

**복구는 하지 않는다.** 파이프라인 중간 상태(Studio job id·Chromium 세션·부분 요약)를 직렬화하는 비용이 기능 전체보다 크다. 대신 **죽었다는 사실을 스레드가 알게 한다** — 부팅 시 `relay_threads` 에서 `status='running'` 인 행을 찾아 `lost` 로 바꾸고 「서버가 재시작돼 중단됐습니다. 다시 멘션해 주세요」를 쓴다. 조용히 사라지는 것보다 낫다.

### F. `emit` 이 내는 이벤트를 그대로 보내면 스레드가 도배된다

`StartEvent` 16종(`types.ts:206-266`) · `ApplyEvent` 13종(`:268-289`). `pipeline.ts` 안의 `emit(` 호출 지점만 20곳이고 그중 `log` 는 단계마다 여러 번 나온다. 신청 단계는 조작마다 `step`, 화면마다 `frame`(**base64 이미지**)이다.

→ §3.2 의 코얼레싱이 필요하다. `frame` 은 채널로 보내지 않는다.

### G. 외부에서 들어오는 요청에 대한 방어가 하나도 없다

`src/proxy.ts:53` 의 matcher 는 `["/app", "/app/:path*", "/sign-in"]` 이다. **`/api/relay/*` 는 프록시를 타지 않는다.** 서명 검증·멱등·신원 확인을 라우트가 직접 해야 하고, 하나라도 빠지면 인터넷의 누구나 우리 LLM 키와 Chromium 을 돌릴 수 있다.

---

## 2. 목표 구조

```
src/app/api/relay/
  telegram/route.ts          텔레그램 웹훅 (Step 0)
  slack/events/route.ts      슬랙 이벤트 웹훅 (Step 4)
  slack/install/route.ts     슬랙 OAuth 시작
  slack/callback/route.ts    슬랙 OAuth 콜백

src/app/(labs)/lab/relay/
  page.tsx                   연동 상태 · 최근 스레드 · 큐
  slack-manifest.json        슬랙 앱 생성용. From a manifest 에 붙여 넣는다
  _lib/
    channel.ts    RelayChannel 인터페이스 — 두 어댑터의 유일한 계약
    slack.ts      Web API 어댑터
    telegram.ts   Bot API 어댑터
    host.ts       ★ 실행 호스트. runStart 를 부르는 유일한 자리 = 리베이스 지점
    store.ts      relay_* 테이블 접근 + 신원 · 연동 코드
    sink.ts       StartEvent → 채널 메시지 (코얼레싱 · 스로틀)      [Step 1]
    answers.ts    자유 텍스트 → needs 배분 (generateObject)          [Step 2]
    queue.ts      동시 실행 상한                                     [Step 1]

src/app/(app)/app/settings/
  relay/route.ts             연동 코드 발급·해제. `/app/*` 아래여야 프록시가 지킨다
  _lib/relay-connections.tsx 설정 화면 카드

src/lib/db/schema.ts         relay_* 4개 테이블을 파일 **끝에** append
src/lib/env.ts               토큰 6개 optional 추가
src/content/labs.ts          항목 한 줄
```

**새 npm 의존성은 0 이다.** 슬랙·텔레그램 API 는 전부 HTTP POST + JSON 이라 `fetch` 로 충분하고, 서명 검증은 `node:crypto` 다. `@slack/web-api` 를 넣으면 `Dockerfile` 과 standalone 트레이싱을 건드릴 이유가 생긴다 — AGENTS.md 의 「지우면 안 되는 것들」 첫 두 줄이 정확히 그 영역이다.

### 채널 계약

두 채널의 차이를 여기 한 파일에 가둔다. `host.ts`·`sink.ts` 는 이 인터페이스만 안다.

> 구현하며 바뀐 것 둘. ① `identity.ts` 는 만들지 않았다 — 신원·연동 코드가 전부 DB 접근이라 `store.ts` 하나로 족하다. ② `Incoming.isThreadStarter` 대신 **`isDirect`** 를 싣는다. 「스레드를 연 사람인가」는 어댑터가 알 수 없고(DB 조회가 필요하다) 호스트가 판단한다. 어댑터가 아는 것은 「1:1 대화인가」뿐이고, 그 값은 연동 코드를 공개 채널에서 받지 않기 위해 필요하다.

```ts
// _lib/channel.ts
export type ChannelId = "slack" | "telegram";

/** 대화 한 줄기. 슬랙은 thread_ts, 텔레그램은 chat_id + 최초 message_id */
export type ThreadRef = { channel: ChannelId; conversation: string; thread: string };

export type Incoming = {
  ref: ThreadRef;
  /** 채널 안에서의 발신자 id. 슬랙 U..., 텔레그램 숫자 */
  from: string;
  text: string;
  files: IncomingFile[];
  /** 멱등 키. 슬랙 event_id, 텔레그램 update_id */
  eventId: string;
  /** 이 스레드를 시작한 사람인가 — 되묻기의 답을 누구에게서 받을지 가른다 */
  isThreadStarter: boolean;
};

export type IncomingFile = { name: string; bytes: number; fetch: () => Promise<Blob> };

export interface RelayChannel {
  id: ChannelId;
  /** 설정이 없으면 false. 라우트는 503 을 돌려주고 앱은 그대로 뜬다 */
  ready(): boolean;
  verify(req: Request, rawBody: string): boolean;
  parse(rawBody: string): Incoming | null;

  /** 스레드에 새 댓글. 반환값은 나중에 고칠 수 있는 손잡이 */
  post(ref: ThreadRef, text: string): Promise<string | null>;
  /** 이미 보낸 메시지를 고친다. 진행 표시줄이 이걸로 산다 */
  edit(ref: ThreadRef, messageId: string, text: string): Promise<void>;
  /** 원요청자를 부른다. 슬랙 `<@U…>`, 텔레그램은 답장 */
  mention(externalId: string): string;
}
```

---

## 3. 축별 설계

### 3.1 실행 호스트

**요청과 실행을 가른다.** 웹훅은 검증·멱등·큐 등록까지만 하고 즉시 200 을 돌려준다.

```ts
// api/relay/telegram/route.ts (뼈대)
export async function POST(req: Request) {
  const raw = await req.text(); // ⚠ 서명 검증에 원문이 필요하다. json() 을 먼저 부르면 못 쓴다
  if (!channel.verify(req, raw)) return new Response("no", { status: 401 });
  const incoming = channel.parse(raw);
  if (!incoming) return Response.json({ ok: true }); // 우리가 모르는 이벤트는 조용히 성공
  if (await seen(incoming.eventId)) return Response.json({ ok: true });

  after(() => handle(channel, incoming)); // next/server 의 after — server.d.ts:21 에 있다
  return Response.json({ ok: true });
}
```

- **3초 안에 200.** 슬랙 Events API 는 늦으면 재시도한다(미검증: 최대 3회). 우리 파이프라인은 분 단위다 — 응답 안에서 돌릴 여지가 없다.
- **`after()` 를 쓰는 이유**는 서버리스 회수가 아니라 의도 표기다. Railway 는 상주 노드 프로세스(`Dockerfile` `CMD ["node","server.js"]`)라 `void promise` 로도 살아남지만, 어느 쪽이든 「응답 뒤에 계속 도는 일」이라는 것이 코드에 보여야 한다.
  - ⚠ 구현 전 `node_modules/next/dist/docs/01-app` 의 Route Handler 문서를 연다. 이 Next 는 우리가 아는 Next 가 아니다(CLAUDE.md).

호스트가 하는 일:

```
1. identity   외부 id → userId. 없으면 「연동하세요」를 쓰고 끝낸다
2. queue      동시 실행 상한. 대기면 「앞에 N건」을 쓰고 자리를 기다린다
3. intake     text + files[0] → IntakeInput  (파일 25MB 상한: run/route.ts:32)
4. sink       ThreadRef 에 묶인 emit 을 만든다
5. runStart(input, emit, { userId })
6. needs      빈 필수 항목이 있으면 스레드로 묻는다 (§3.3)
7. hand-off   1단계에서는 신청 링크를 준다. 5단계에서 여기가 apply 로 이어진다
```

**`host.ts` 는 `runStart` 를 부르는 유일한 자리다.** 개편 세션이 그 시그니처를 바꾸면 고칠 곳이 한 줄이 된다(§6).

### 3.2 중계 — 무엇을 언제 보내는가

**메시지 두 종류로 줄인다.**

|                 | 무엇                                             | 어떻게                                                 |
| --------------- | ------------------------------------------------ | ------------------------------------------------------ |
| **진행 표시줄** | 현재 단계 · 8단계 중 몇 번째 · 마지막 로그 한 줄 | 스레드에 **한 번** 올리고 그 뒤로는 `edit`. 3초 스로틀 |
| **이정표**      | 새 댓글                                          | 아래 6종만                                             |

이정표로 승격하는 이벤트:

| 이벤트                        | 근거                                                             | 스레드에 쓰는 것           |
| ----------------------------- | ---------------------------------------------------------------- | -------------------------- |
| `card`(7종, `types.ts:52-60`) | 서술자가 사람 말로 쓴 문장이다. 카드가 곧 이정표                 | headline + body            |
| `verdict`                     | 「착수할 만한가」 판정. bad 면 여기서 끝난다                     | 판정 + 이유                |
| `needs`                       | 사람에게 물어야 할 것                                            | §3.3                       |
| `artifacts`                   | 만든 서류 목록                                                   | 파일명 + 무엇으로 채웠는지 |
| `end` / `error`               | **모든 종료 경로가 낸다**(`types.ts:255-262` 가 그렇게 설계됐다) | 끝난 이유                  |
| `session`                     | `goals.id` — 「이어서 하기」 링크의 재료                         | 링크                       |

버리는 것: `log`(진행 표시줄의 마지막 줄로만), `orchestrator`, `stage`(표시줄 숫자로만), `files`, `via`, `run`.
**보내지 않는 것: `frame`.** base64 이미지가 스텝마다 나온다(`apply/route.ts:371`). 채널에 올릴 물건이 아니다 — 신청 화면을 보고 싶으면 `/app` 링크다.

**추정**: 준비 한 건 = 새 댓글 ~10개 + 편집 ~40회. 슬랙 `chat.update` 한도(미검증, Tier 3) 안쪽으로 본다. Step 1 에서 실제로 세어 이 줄을 갈아끼운다.

### 3.3 되묻기

```
1. sink 가 {type:"needs"} 를 받는다
2. 빈 필수 항목만 고른다
     need.kind !== "file" && !need.value?.trim()
     — start-flow.tsx:328-330 과 **같은 조건**을 쓴다. 다르면 화면과 스레드가
       서로 다른 것을 묻기 시작한다
3. 원요청자를 멘션하고 번호 목록으로 한 번에 묻는다
4. 사람이 스레드에 답장한다 — 자유 텍스트, 또는 파일 첨부
5. answers.ts 가 배분한다
6. 아직 빈 항목이 있으면 그것만 다시 묻는다 (최대 2회)
```

**왜 폼이 아니라 자유 텍스트인가.** 슬랙 modal 은 `trigger_id` 가 필요하고 그 값은 사용자 상호작용 직후 3초 안에만 쓸 수 있다(미검증) — 에이전트가 90초 뒤에 묻는 상황과 맞지 않는다. 텔레그램에는 modal 자체가 없다. 두 채널의 공통 분모는 「글 한 통」이다.

배분은 모델이 한다. `_lib/reconcile.ts:39` 가 이미 같은 종류의 병합(정보 분석의 「성명」 = 폼의 「이름」)을 하고 있으므로 패턴이 있다.

```ts
// _lib/answers.ts
export async function parseAnswers(
  needs: Need[],
  text: string,
  ctx: Ctx,
): Promise<{ filled: Record<string, string>; unmatched: string[] }>;
```

⚠ **Upstage 구조화 출력 함정 두 개를 그대로 밟는다**(AGENTS.md). 시스템 프롬프트에 `json` 이라는 단어가 있어야 하고, **필드 계약을 프롬프트에 직접 박아야 한다** — zod 스키마는 모델에게 전달되지 않는다. `_lib/extract.ts` 의 우회를 복사한다.

**확신 없는 배분은 채우지 않는다.** 「1999-04-12」가 생년월일인지 설립일인지 모르겠으면 비워 두고 다시 묻는다. 잘못 채우면 사용자 명의로 실제 접수되는 값이 틀린다.

**답은 원요청자에게서만 받는다.** `Incoming.isThreadStarter` 가 false 면 무시하고 그렇게 말한다 — 지식베이스(`memories`)는 사용자별이라 다른 사람의 값을 섞으면 그 사람 회사 정보가 남의 신청서에 들어간다.

**신청 도중 되묻기(`ask()`)는 15분이 상한이다.** §1-D 의 이유 그대로 — Chromium·Xvfb 를 몇 시간 붙잡을 수 없다. 넘어가면 실행을 접고 스레드에 「받은 값으로 다시 이어서 하기」 링크를 남긴다.

### 3.4 채널 어댑터 — 차이는 여기서 끝난다

|             | 슬랙                                                                                              | 텔레그램                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 설치        | 앱 manifest + OAuth(워크스페이스 단위)                                                            | `@BotFather` 로 토큰 하나                                                              |
| 웹훅 등록   | 앱 설정에서 Request URL                                                                           | `setWebhook` 한 번                                                                     |
| 검증        | `X-Slack-Signature` = `v0=` + HMAC-SHA256(`v0:{ts}:{raw}`, signing secret). ts 가 5분 밖이면 거절 | `setWebhook` 의 `secret_token` ↔ `X-Telegram-Bot-Api-Secret-Token` 상수시간 비교       |
| 트리거      | `app_mention` 이벤트 + DM `message.im`                                                            | 모든 메시지 (봇과의 1:1)                                                               |
| 스레드      | 네이티브 `thread_ts`                                                                              | 없다. `reply_to_message_id` 로 잇고, `chat_id + 최초 message_id` 를 스레드 키로 삼는다 |
| 멘션        | `<@U01ABC>`                                                                                       | 없다. 답장으로 대신한다                                                                |
| 진행 표시줄 | `chat.update`                                                                                     | `editMessageText`                                                                      |
| 파일 받기   | `file.url_private` + `Authorization: Bearer <bot token>` (`files:read` 필요)                      | `getFile` → `api.telegram.org/file/bot<token>/<path>`                                  |
| 필요 스코프 | `app_mentions:read` `chat:write` `files:read` `im:history` `users:read`                           | 없음                                                                                   |
| 로컬 개발   | 공개 HTTPS 필요 → ngrok, 또는 배포본으로 테스트                                                   | 같음. 단 `getUpdates` 폴링으로 떨어질 수 있다                                          |
| 비용(추정)  | ~1일                                                                                              | ~반나절                                                                                |

**슬랙을 먼저 만든다.** 데모의 얼굴이고, 「기업 지식베이스」라는 이 제품의 해자가 사는 곳이 슬랙이기 때문이다. 대가는 실패 원인이 둘로 섞인다는 것 — 「스코프가 없어서」와 「우리 코드가 틀려서」. 그래서 Step 0 을 **왕복 확인까지로 좁히고**, 어댑터의 순수 부분(서명·파싱·언랩)은 슬랙 앱 없이 로컬에서 43항목으로 먼저 검증했다. 남는 미지수가 「설치·스코프」 하나로 줄어든다.

**그럼에도 두 채널을 다 하는 이유**는 `RelayChannel` 이 강제되기 때문이다. 하나만 만들면 슬랙 개념(`thread_ts`, `trigger_id`)이 `host.ts` 로 새어 들어가고, 그때는 두 번째 채널이 리팩터가 된다.

### 3.5 신원과 신뢰 경계

**연동은 deep link 로 한다. 두 채널 모두 같은 방식이다.**

```
/app/settings 에서 「텔레그램 연동」 → 일회용 코드 발급 (TTL 10분)
  → t.me/<bot>?start=<code>  링크를 연다
  → 봇이 `/start <code>` 를 받는다
  → relay_identities 에 (telegram, from) → userId 를 쓴다
```

슬랙은 워크스페이스 설치(OAuth)와 개인 매핑이 별개다. 설치는 `relay_installs`(팀 토큰), 매핑은 봇 DM 으로 같은 코드를 보낸다.

**매핑이 없는 사람이 멘션하면 실행하지 않는다.** 스레드에 연동 링크를 쓰고 끝낸다. 이유가 셋이다 — 지식베이스(`memories`)가 사용자별이고, 결과를 `goals` 에 남길 주인이 필요하고, 우리 LLM 키를 아무나 쓰면 안 된다.

방어선:

| 층        | 무엇                                                                        | 막는 것                            |
| --------- | --------------------------------------------------------------------------- | ---------------------------------- |
| 서명 검증 | HMAC / secret token                                                         | 우리 URL 을 아는 외부인            |
| 멱등      | `relay_events(id)` insert-on-conflict-do-nothing + 슬랙 `X-Slack-Retry-Num` | 재시도로 같은 신청이 세 번 도는 것 |
| 신원      | `relay_identities` 조회                                                     | 연동 안 한 사람의 실행             |
| 큐        | 사용자당 1 · 전역 2                                                         | 멘션 세 통으로 Chromium 6개        |
| 파일 상한 | 25MB(입력) / 5MB(첨부) — `run/route.ts:32`·`documents/route.ts:20` 재사용   | 메모리                             |

⚠ **원문 바디를 먼저 읽는다.** `req.json()` 을 부르면 서명 계산에 쓸 문자열이 사라진다. `await req.text()` → 검증 → `JSON.parse`.

### 3.6 영속성과 재배포

DB 에 남기는 것은 **재개에 필요한 것이 아니라 설명에 필요한 것**이다(§1-E).

```
relay_threads: ref · userId · goalId · status · lastMessageId · pendingNeeds · updatedAt
status: queued → running → asking → ready → applying → done | lost | error
```

- `pendingNeeds` 는 「지금 무엇을 묻고 있는가」의 단일 진실이다. 프로세스 Map 이 아니라 여기 있어야 답장이 어느 질문에 대한 것인지 재시작 뒤에도 안다 — 되묻기는 파이프라인 밖에서 대기하므로(§1-C) **이 경로만은 재배포를 넘길 수 있다.**
- 부팅 시 한 번 쓸어 `running|applying` 을 `lost` 로 바꾸고 스레드에 알린다.
- 결과는 기존 `goals` 에 그대로 쓴다. 릴레이용 결과 테이블을 따로 만들지 않는다.

### 3.7 자원 상한

준비 한 건이 실제로 무엇을 잡는가:

| 자원                                     | 근거                                                   |
| ---------------------------------------- | ------------------------------------------------------ |
| Studio job 2건 (유효성 검사 · 정보 분석) | 각각 45~180초 (`upstage-studio.ts:158`)                |
| Chromium — 문서 렌더마다 launch/close    | `render/pdf.ts:15-31`, `file-agent.ts:280`             |
| 신청까지 가면 Chromium 2개 더            | `probeCaptcha`(`apply/route.ts:353`) + 본 실행(`:361`) |

개편 문서 §2.1 이 `lanes.browser(2)` 를 계획하고 있지만 그건 그쪽 Step 2 다. **릴레이는 자기 폴더 안에서 자체 큐를 건다** — 사용자당 1, 전역 2. 대기 중이면 스레드에 「앞에 N건 있습니다」를 쓴다. 개편의 레인이 들어오면 이 큐는 남겨도 무해하다(이중 상한).

---

## 4. 데이터 모델

`src/lib/db/schema.ts` **끝에** append 한다 — 그 파일 위쪽은 개편이 만질 수 있고, 끝에 붙이면 리베이스 충돌이 거의 없다.

```ts
// ⚠ `uniqueIndex` 는 schema.ts 의 현재 import 목록(`:1-11`)에 없다. 같이 추가한다.
export const relayChannel = pgEnum("relay_channel", ["slack", "telegram"]);

/** 슬랙 워크스페이스 설치. 텔레그램은 봇 토큰이 env 하나라 행이 안 생긴다 */
export const relayInstalls = pgTable("relay_installs", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: relayChannel("channel").notNull(),
  /** 슬랙 team_id */
  workspaceId: text("workspace_id").notNull().unique(),
  workspaceName: text("workspace_name"),
  /** xoxb-… 워크스페이스별 봇 토큰 */
  botToken: text("bot_token").notNull(),
  scopes: text("scopes"),
  installedBy: text("installed_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 외부 계정 ↔ Antelope 사용자. 이게 없으면 실행하지 않는다 */
export const relayIdentities = pgTable(
  "relay_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    channel: relayChannel("channel").notNull(),
    /** 슬랙 U…, 텔레그램 숫자 id */
    externalId: text("external_id").notNull(),
    workspaceId: text("workspace_id"),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 같은 사람이 두 번 연동해도 행이 하나여야 한다
    uniqueIndex("relay_identity_uniq").on(t.channel, t.externalId, t.workspaceId),
    index("relay_identity_user_idx").on(t.userId),
  ],
);

/** 대화 한 줄기 = 실행 한 건 */
export const relayThreadStatus = pgEnum("relay_thread_status", [
  "queued",
  "running",
  "asking",
  "ready",
  "applying",
  "done",
  "lost",
  "error",
]);

export const relayThreads = pgTable(
  "relay_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    channel: relayChannel("channel").notNull(),
    conversation: text("conversation").notNull(),
    thread: text("thread").notNull(),
    /** 스레드를 연 사람. 되묻기의 답은 이 사람에게서만 받는다 */
    starterExternalId: text("starter_external_id").notNull(),
    status: relayThreadStatus("status").notNull().default("queued"),
    /** goals.id — 「이어서 하기」 링크와 결과 기록의 대상 */
    goalId: uuid("goal_id"),
    /** in-flight 실행의 runId. run-registry 의 열쇠 */
    runId: text("run_id"),
    /** 진행 표시줄로 쓰는 메시지. edit 로 갱신한다 */
    progressMessageId: text("progress_message_id"),
    /** 지금 무엇을 묻고 있는가. 재시작을 넘기는 유일한 상태 */
    pendingNeeds: jsonb("pending_needs"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("relay_thread_uniq").on(t.channel, t.conversation, t.thread),
    index("relay_thread_user_idx").on(t.userId, t.updatedAt),
  ],
);

/** 멱등. 슬랙 event_id · 텔레그램 update_id */
export const relayEvents = pgTable("relay_events", {
  id: text("id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**AGENTS.md 의 「lab 은 새 테이블 대신 `documents.raw` 를 쓴다」에서 벗어난다.** 이유를 적어 둔다 — 봇 토큰과 신원 매핑에는 **유니크 제약과 조회 키**가 필요하다. jsonb 한 칸에 넣으면 같은 사람이 두 번 연동했을 때 행이 둘이 되고, 그 시점에 어느 쪽 토큰이 유효한지 코드가 알 수 없다. 멱등 테이블은 primary key 가 곧 기능이다.

버리는 비용은 그대로 낮게 유지한다 — `drop table relay_events, relay_threads, relay_identities, relay_installs; drop type relay_channel, relay_thread_status;` 여섯 줄이다.

⚠ **스키마를 바꾸면 프로덕션에도 push 한다.** `pnpm db:push` 는 로컬만 건드린다 — AGENTS.md 에 `memories` 추가 후 `/app/knowledge` 가 런타임에 죽은 실측이 있다. TCP 프록시 절차는 그 문서에 있다.

### 환경변수

`src/lib/env.ts` 관습대로 **전부 optional** 이다. 없으면 라우트가 503 을 돌려주고 앱은 그대로 뜬다.

```
TELEGRAM_BOT_TOKEN          없으면 /api/relay/telegram 이 503
TELEGRAM_WEBHOOK_SECRET     setWebhook 의 secret_token 과 같은 값
SLACK_SIGNING_SECRET
SLACK_CLIENT_ID
SLACK_CLIENT_SECRET
SLACK_BOT_TOKEN             단일 워크스페이스 지름길. 있으면 relay_installs 조회를 건너뛴다
RELAY_PUBLIC_URL            deep link · OAuth 콜백의 기준. 없으면 BETTER_AUTH_URL
```

---

## 5. 실행 순서

원칙은 개편 문서와 같다 — **각 단계 끝에서 데모가 돈다.**

> 순서가 문서 초안과 다르다. 초안은 텔레그램을 먼저 뚫자고 했지만, 데모의 얼굴이
> 슬랙이라 슬랙을 먼저 세운다. 대가는 Step 0 에서 앱 설치·스코프·서명이 한꺼번에
> 걸린다는 것이고, 그래서 **Step 0 을 「봇이 나를 안다」까지로 좁혔다** — 파이프라인을
> 붙이기 전에 왕복이 되는지부터 본다.

### Step 0 — 슬랙 왕복 ✅ 구현 완료 (검증 43항목 통과)

파이프라인을 붙이지 않는다. 「봇이 나를 안다」까지만.

| 무엇                                 | 어디                                      |
| ------------------------------------ | ----------------------------------------- |
| 채널 계약                            | `lab/relay/_lib/channel.ts`               |
| 슬랙 어댑터 — 서명·파싱·발신·파일    | `lab/relay/_lib/slack.ts`                 |
| DB 접근 — 멱등·신원·연동 코드·스레드 | `lab/relay/_lib/store.ts`                 |
| 호스트 (지금은 에코 + 연동)          | `lab/relay/_lib/host.ts`                  |
| 웹훅                                 | `api/relay/slack/events/route.ts`         |
| 코드 발급·해제                       | `app/settings/relay/route.ts`             |
| 설정 화면 카드                       | `app/settings/_lib/relay-connections.tsx` |
| 실험 화면                            | `lab/relay/page.tsx`                      |
| 앱 manifest                          | `lab/relay/slack-manifest.json`           |
| 스키마 4테이블 · env 2개             | `lib/db/schema.ts` 끝 · `lib/env.ts`      |

**로컬에서 확인한 것** (`pnpm exec tsx` 로 어댑터와 store 를 직접 돌렸다. 슬랙 앱 없이 되는 데까지):

- `unwrapSlack` 6항목 — 라벨 붙은 링크가 URL 로 풀리고, 그 결과가 `run/route.ts:38` 의 `^https?://` 검사를 통과한다
- `verify` 6항목 — 올바른 서명 통과, 본문 변조·다른 시크릿·6분 지난 요청 거절, **짧은 서명에서 `timingSafeEqual` 이 던지지 않는다**(던지면 라우트가 500 이 되고 슬랙이 재시도를 쌓는다)
- `parse` 18항목 — challenge, 채널 멘션, 스레드 뿌리 계산, DM, **DM 의 `app_mention` 을 버려 중복 실행을 막는 것**, 봇·편집 무시, `file_share` 수용, 첨부 파싱
- 멱등 2항목 — 같은 `event_id` 두 번에 한 번만 통과
- 연동 코드 5항목 — 8자 모양, 성공, **재사용(`used`)과 만료(`expired`)를 구분**
- 신원 4항목 — 워크스페이스가 다르면 남, 재연동 시 행이 늘지 않고 주인만 바뀐다
- 스레드 4항목 — 나중에 낀 사람이 주인이 되지 않는다, 재시작 스윕이 `running` → `lost`

**아직 확인 못 한 것** — 슬랙 앱이 있어야 한다:

| 무엇                                        | 왜 지금 못 하나                                      |
| ------------------------------------------- | ---------------------------------------------------- |
| Request URL 등록 (challenge 왕복)           | 공개 HTTPS 가 필요하다. 배포본이나 ngrok             |
| `chat.postMessage` / `chat.update`          | 봇 토큰이 필요하다                                   |
| 파일 다운로드 (`files:read` + Bearer)       | 같음. §8-4                                           |
| `app_mention` 에 `channel_type` 이 실리는지 | 안 실려도 채널 id 의 `D` 접두로 걸러진다(둘 다 본다) |

**남은 사람 몫** — 이건 코드가 못 한다:

1. api.slack.com/apps → **From a manifest** 에 `slack-manifest.json` 을 붙여 넣어 앱 생성
2. 워크스페이스에 설치
3. Basic Information → Signing Secret → `SLACK_SIGNING_SECRET`
4. OAuth & Permissions → Bot User OAuth Token(`xoxb-…`) → `SLACK_BOT_TOKEN`
5. 로컬·Railway 양쪽에 넣는다. Railway 는 `echo "값" | railway variable set KEY --stdin --service web`
6. 프로덕션 DB 에 스키마 push — **로컬 `db:push` 는 프로덕션을 안 건드린다** (AGENTS.md 의 TCP 프록시 절차)

**완료 판정**: `/app/settings` 에서 코드를 받아 봇과의 1:1 대화에 보내면 「연결됐습니다」가 오고, 그 뒤 채널에서 `@Antelope` 를 멘션하면 스레드에 답이 달린다. 같은 이벤트가 재전송돼도 한 번만 처리된다.
**롤백**: `api/relay` 를 지우고 슬랙 앱 이벤트 구독을 끈다.

### Step 1 — 호스트와 중계 (하루)

무엇을: `host.ts` 의 에코를 `runStart` 로 바꾼다. `sink.ts`(진행 표시줄 + 이정표) · `queue.ts`(전역 2 · 사용자당 1). 신청은 안 한다 — `end` 에서 `/app/goals/<id>` 링크를 준다.

**완료 판정**: 슬랙에 공고 링크를 보내면 8단계가 스레드에서 진행되고, 끝에 준비 문서 요약과 이어서 하기 링크가 온다. 그 링크로 `/app` 을 열면 준비된 세션이 그대로 있다(`goals.snapshot`). **새 댓글 수와 편집 수를 실제로 센다** — §3.2 의 추정을 그 값으로 바꾼다.
**롤백**: `host.ts` 를 Step 0 의 에코로 되돌린다.

### Step 2 — 되묻기 (반나절)

무엇을: `answers.ts` · `pendingNeeds` 저장 · 답장 라우팅.

**완료 판정**: 빈 필수 항목이 3개인 공고를 넣으면 봇이 번호 목록으로 묻고, 한 통에 자유롭게 답하면 3개가 채워진 채 `ready` 가 된다. 확신 없는 값은 채우지 않고 다시 묻는다. **서버를 재시작해도** 그 뒤에 온 답장이 같은 질문에 붙는다.
**롤백**: 질문을 안 하고 바로 `ready` 로 간다(Step 1 동작).

### Step 3 — 파일 (반나절)

무엇을: 첨부 다운로드 → `IntakeInput.file`, 답장 첨부 → `artifactDir(runId)` + 보관함(`rememberDocument`, `_lib/documents.ts`).

**완료 판정**: PDF 공고를 첨부해 보내면 그것으로 준비가 돈다. 「사업자등록증을 주세요」에 파일로 답하면 `user_documents` 에 남아 **다음 공고에서 다시 묻지 않는다.**
**롤백**: 파일을 무시하고 텍스트만 읽는다.

### Step 4 — 텔레그램 (반나절)

무엇을: `telegram.ts` · `api/relay/telegram/route.ts` · env 2개. `host.ts`·`sink.ts`·`store.ts` 는 **건드리지 않는다.**

**완료 판정**: 텔레그램에서 Step 0~3 과 **글자 그대로 같은 흐름**이 돈다. `host.ts`·`sink.ts` 의 diff 가 0 이면 채널 계약이 맞은 것이다 — 0 이 아니면 샌 개념을 `channel.ts` 로 밀어 넣는다.
**롤백**: 텔레그램 라우트만 지운다. 슬랙은 그대로 돈다.

### Step 5 — 신청까지 서버에서 (M)

**선행 조건은 이미 충족됐다.** 개편 세션이 Step 0 을 넣었다 — 코드로 확인한 것:

| 항목                       | 확인                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| 0-b 성공을 성공이라 말한다 | `apply/route.ts:510` 의 `emit(agent done)` 이 `:512` `controller.close()` **앞**에 있다      |
| 0-c 서버가 결과를 기록한다 | `apply/route.ts:524` `void saveApplyResult(userId, goalId, …)`                               |
| 0-g runId 소유권           | `run-registry.ts:26` `Run.userId` · `:57` `openRun(id, userId)` · `:83` `hasRun(id, userId)` |

`apply/route.ts` 를 뽑는 작업이 지금 열려 있다. 다만 개편이 아직 이 파일을 만질 수 있으니 착수 전에 `git log -3 -- apply/route.ts` 로 최근 손댐을 보고 팀에 한마디 한다.

무엇을: `apply/route.ts:163-519` 의 실행 본문을 `_lib/apply.ts` 의 `runApply(args, emit)` 로 뽑는다. 라우트는 파싱 + SSE 배관만 남는다. `host.ts` 가 준비 직후 같은 함수를 부른다.

**완료 판정**: 슬랙에서 멘션 한 번으로 준비 → 되묻기 → 실제 접수까지 가고, 스레드 마지막 댓글이 접수 결과다. `/app` 을 한 번도 열지 않는다. `goals.result` 에 행이 남는다.
**롤백**: `host.ts` 가 다시 링크만 준다. 뽑아낸 함수는 남겨도 무해하다(라우트가 계속 쓴다).

---

## 6. 개편 세션과의 관계

### 릴레이가 의존하는 계약 셋

```ts
runStart(input: IntakeInput, emit: (e: StartEvent) => void, opts: { userId: string | null })
ask(runId, {id,label}) / answer(runId, id, value)     // run-registry.ts
StartEvent 유니온                                      // types.ts:206-266
```

### 개편이 이것들을 어떻게 건드리는가

| 릴레이가 쓰는 것         | 개편이 하는 일                                                             | 판정                                                |
| ------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------- |
| `runStart` 시그니처      | **안 바꿨다** (2026-08-22 확인). Step 8(취소)이 `opts.signal` 을 더할 예정 | ✅ 호환. `opts` 는 객체라 필드 추가가 깨지지 않는다 |
| `StartEvent`             | `stage` 에 `ms?: number` 가 **들어갔다** (`types.ts:222`)                  | ✅ 호환. 모르는 필드는 무시된다                     |
| `run-registry`           | `hasRun(id, userId)` · `openRun(id, userId)` 로 **바뀌었다**               | △ Step 2 에서 `host.ts` 가 이 시그니처로 부른다     |
| `memory.recallForFields` | Step 5 가 쿼리 형태를 바꾼다                                               | ✅ 시그니처 유지. 무관                              |
| `apply/route.ts`         | Step 0-b·0-c·0-g 가 **이미 들어갔다**                                      | ✅ Step 5 가 열렸다                                 |
| `schema.ts`              | 개편은 스키마를 안 바꾼다(인덱스 사용 형태만)                              | ✅ 파일 끝 append                                   |

### 규칙 셋

1. **릴레이는 `(app)/app/start/_lib/*` 를 고치지 않는다.** 읽어서 쓴다. AGENTS.md 의 lab 규칙과 같은 이유다.
2. **`runStart` 를 부르는 자리는 `host.ts` 한 곳이다.** 시그니처가 바뀌면 리베이스가 한 줄이다.
3. **`apply/route.ts` 를 뽑기 전에 최근 손댐을 본다.** 개편 Step 0 은 들어갔지만, 같은 400줄을 양쪽이 동시에 다시 쓰면 리베이스 전면전이 된다.

### 진행 메모 (2026-08-22)

- 개편 세션이 `perf(start)`·`perf(browser)`·`perf(ai)`·`perf(memory)`·`perf(studio)` 다섯 커밋을 넣었다. 그 문서의 Step 0~6 대부분이다.
- **`runStart(input, emit, {userId})` 는 그대로다.** 릴레이가 의존하는 계약 하나가 다섯 커밋을 그대로 통과했다 — 호스트를 한 곳에 가둔 선택이 값을 했다.
- ⚠ 그 과정에서 **릴레이 파일 셋(`channel.ts`·`slack.ts`·`store.ts`)이 `de9466d`「perf(browser): 지나간 화면을 버린다」에 함께 커밋됐다.** 무관한 파일이 쓸려 들어간 것이라 내용은 온전하고 히스토리만 지저분하다. 셋이 같은 워크트리를 공유하는 동안 `git add -A` 는 이런 일을 만든다 — 커밋할 파일을 명시하는 편이 낫다.

---

## 7. 버릴 때

AGENTS.md 의 lab 규칙대로 **버리는 비용이 낮아야 한다.**

```
rm -rf src/app/\(labs\)/lab/relay src/app/api/relay
git checkout src/lib/db/schema.ts src/lib/env.ts src/content/labs.ts   # append 만 되돌린다
psql: drop table relay_events, relay_threads, relay_identities, relay_installs;
      drop type relay_channel, relay_thread_status;
```

프로덕션 코드에 남기는 것은 `/app/settings` 의 연동 카드 하나뿐이고, 그것도 env 가 없으면 그려지지 않는다(`enabledProviders` 와 같은 방식, `auth.ts:41`).

---

## 8. 열린 질문 — Step 0 이 답한다

| #   | 질문                                                                                | 틀렸을 때 무너지는 곳                                                                                  |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | **Railway 재배포에 grace period 가 있는가.** 있으면 진행 중 실행이 마무리될 수 있다 | 없으면 §3.6 의 `lost` 표기가 유일한 대책이다. 있으면 그 시간만큼 덜 죽는다                             |
| 2   | 슬랙 `chat.update` 의 실제 rate limit                                               | 넘으면 진행 표시줄이 멈춘다. 스로틀을 3초 → 10초로 올리면 된다                                         |
| 3   | 텔레그램 웹훅 응답 타임아웃                                                         | 넘으면 같은 업데이트가 재전송된다. 멱등이 이미 막지만 로그가 지저분해진다                              |
| 4   | 슬랙 파일이 봇 토큰 Bearer 로 실제로 받아지는가(`files:read`)                       | 안 되면 파일 첨부 경로가 슬랙에서만 죽는다. 「링크로 주세요」로 떨어진다                               |
| 5   | **자유 텍스트 → needs 배분의 정확도**                                               | 골든셋이 없다(개편 문서 §0.1 이 지적한 그 문제). Step 2 에서 손으로 만든 10건으로 재는 것이 최소선이다 |
| 6   | 슬랙 앱 배포 심사가 필요한가 — 우리 워크스페이스 안에서만 쓰면 불필요할 것으로 본다 | 필요하면 데모 전에 못 끝낸다. 그 경우 텔레그램(Step 4)이 데모 얼굴이 된다                              |

⚠ 6번은 구글 OAuth 브랜딩 심사에서 이미 한 번 밟은 종류의 함정이다(AGENTS.md, `*.up.railway.app` 으로는 통과 불가). **외부 배포가 필요한 순간 도메인 문제가 같이 따라온다** — 워크스페이스 내부 설치로 끝나는지를 Step 0 설치 때 확인한다.
