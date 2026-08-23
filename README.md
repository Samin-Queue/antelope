![Antelope — powered by Upstage](./docs/brand/banner.png)

# Antelope

**Document agent that reads a public notice and completes the application for you.**
**공고를 읽고 신청까지 대신 수행하는 문서 에이전트.**

JunctionX Korea 2026 (Pohang, Aug 21–23) · Team **Samin Queue**
Live demo: https://antelope.up.railway.app

**[English](#english) · [한국어](#한국어) · [Open Source](#open-source)**

---

# English

## Quick start

You need **three things installed**: Node.js, pnpm, and Docker. Everything else is
handled by the commands below. If you have none of them, start at
[Prerequisites](#prerequisites).

```bash
git clone https://github.com/Samin-Queue/antelope.git
cd antelope

pnpm install                   # installs dependencies, configures git hooks
cp .env.example .env.local     # then fill it in — see "Environment variables"
pnpm docker:db                 # starts PostgreSQL in Docker
pnpm db:push                   # creates the database tables
pnpm dev                       # http://localhost:3000
```

Open http://localhost:3000. If it loads, you are running.

> **The app boots with an empty `.env.local`.** Verified by emptying the file:
> `/`, `/demo`, `/demo/hiring`, `/demo/hiring/apply`, `/lab`, and `/playground` all
> return 200. Features light up as you add keys — the table below says exactly which
> key unlocks what.

### Prerequisites

| Tool        | Version                            | How to install                                                                                                                                  |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js** | 24.2.0 (pinned in `.nvmrc`)        | [nvm](https://github.com/nvm-sh/nvm): `nvm install` in the repo root reads `.nvmrc` for you. Or download from [nodejs.org](https://nodejs.org). |
| **pnpm**    | 10.12.3 (pinned in `package.json`) | `corepack enable && corepack prepare pnpm@10.12.3 --activate` — Corepack ships with Node.                                                       |
| **Docker**  | any recent                         | [Docker Desktop](https://www.docker.com/products/docker-desktop/). Only needed for the local database.                                          |

Run `pnpm doctor` at any point — it checks each of these and tells you exactly what
is missing and how to fix it.

**Prefer not to install anything?** Open the repo in VS Code or Cursor and choose
**Reopen in Container**. The devcontainer brings its own Node, pnpm, database, and
CLI tools. You still need Docker.

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you need. **Nothing is
mandatory to boot** — each key unlocks a feature.

`.env.local` is listed in `.gitignore`. Never commit it.

### The two that matter most

| Variable          | Unlocks                                                      | Where to get it                                                                                                                               |
| ----------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `UPSTAGE_API_KEY` | Chat, document parsing, embeddings — the core of the product | Sign up at [console.upstage.ai](https://console.upstage.ai) → **API Keys** → create one. Keys start with `up_`. There is a free trial credit. |
| `DATABASE_URL`    | Knowledge base, saved documents, vector search               | Already filled in `.env.example` for local Docker. Run `pnpm docker:db` and it just works.                                                    |

With those two, everything except OAuth login and demo email works.

### Everything else

| Variable                                     | Default                 | What happens if empty                                                                                                                                                                         |
| -------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LLM_PROVIDER`                               | `upstage`               | Switches the model provider. Valid: `upstage`, `azure`, `backendai`, `openai`, `custom`.                                                                                                      |
| `LLM_MODEL` · `LLM_BASE_URL` · `LLM_API_KEY` | —                       | Override the provider preset. Leave empty unless you know you need it.                                                                                                                        |
| `UPSTAGE_AGENT_ID`                           | —                       | Falls back to calling Upstage v1 REST endpoints directly instead of a Studio agent pipeline. The app still works.                                                                             |
| `AZURE_API_KEY` · `AZURE_BASE_URL`           | —                       | Only needed when `LLM_PROVIDER=azure`. Base URL must be the new v1 path: `https://<resource>.services.ai.azure.com/openai/v1`, and `LLM_MODEL` takes the **deployment name**, not a model id. |
| `BACKENDAI_API_KEY` · `BACKENDAI_BASE_URL`   | —                       | Only for `LLM_PROVIDER=backendai`.                                                                                                                                                            |
| `OPENAI_API_KEY`                             | —                       | Only for `LLM_PROVIDER=openai`.                                                                                                                                                               |
| `BETTER_AUTH_SECRET`                         | —                       | Sign-in is disabled. Generate one with `openssl rand -base64 32`.                                                                                                                             |
| `BETTER_AUTH_URL`                            | `http://localhost:3000` | Must match the origin you browse from.                                                                                                                                                        |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET`  | —                       | The Google button is not rendered. Create credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials); callback URL is `{origin}/api/auth/callback/google`.      |
| `GITHUB_CLIENT_ID` · `GITHUB_CLIENT_SECRET`  | —                       | The GitHub button is not rendered. Create an OAuth app at [github.com/settings/developers](https://github.com/settings/developers); callback URL is `{origin}/api/auth/callback/github`.      |

### Demo email (optional)

The demo application sites under `/demo` can send real verification codes and
interview invitations over SMTP.

| Variable                  | Notes                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SMTP_HOST` · `SMTP_PORT` | `smtp.gmail.com` and `465` are pre-filled.                                                                                                                                    |
| `SMTP_USER`               | Your Gmail address.                                                                                                                                                           |
| `SMTP_PASSWORD`           | A Gmail **App Password**, not your login password. Google Account → Security → turn on 2-Step Verification → App passwords → generate 16 characters. Enter it without spaces. |
| `SMTP_FROM_NAME`          | Display name on the sent mail.                                                                                                                                                |
| `DEMO_MAIL_ALLOWLIST`     | Leave empty to send to anyone. Set to `me@example.com,@yourdomain.com` to restrict recipients. Rate limits (5 per IP, 3 per address per 10 min) always apply.                 |

Leave these empty and the flow still works in development — the code is returned in
the API response and shown on screen with a warning. In production it fails loudly
with a 503 instead of silently passing.

## Verify it works

```bash
curl http://localhost:3000/api/health
```

**With no API key yet** — this is what a fresh checkout returns, and it is fine:

```json
{
  "ok": true,
  "db": "configured",
  "llm": { "error": "[llm] upstage: API key 미설정 (LLM_API_KEY)" }
}
```

**Once `UPSTAGE_API_KEY` is set:**

```json
{
  "ok": true,
  "db": "configured",
  "llm": { "provider": "upstage", "model": "solar-pro4" }
}
```

`"db": "missing"` means `DATABASE_URL` is unset or Postgres is not running. The app
still serves every page that does not need the database.

## What to look at

| Path          | What it is                                                                                                                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`           | Landing page. All copy lives in `src/content/site.ts`.                                                                                                                                                                                                                                                                          |
| `/app`        | The product: documents, knowledge base, playground.                                                                                                                                                                                                                                                                             |
| `/demo`       | Seven fictional application sites used to test the agent end to end. Each has a notice page and an application form, and every form uses a different mechanism — multi-step wizards, dynamic rows, cascading selects, drag-and-drop upload, HWP form round-trips, and a signup-plus-login gate. Not linked from any navigation. |
| `/lab`        | Parallel experiments. Marked with a dashed banner so it is never mistaken for production.                                                                                                                                                                                                                                       |
| `/api/health` | Provider, model, and database status.                                                                                                                                                                                                                                                                                           |

## Commands

```bash
pnpm dev            # development server
pnpm build          # production build (includes type checking)
pnpm typecheck      # types only
pnpm lint
pnpm format         # apply Prettier
pnpm format:check   # same check CI runs

pnpm docker:db      # PostgreSQL only
pnpm docker:up      # app + PostgreSQL
pnpm docker:prod    # run the production image locally
pnpm docker:down

pnpm db:push        # apply schema changes
pnpm db:studio      # browse the database

pnpm doctor         # diagnose a broken environment
```

## Troubleshooting

| Symptom                          | Fix                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm: command not found`        | `corepack enable && corepack prepare pnpm@10.12.3 --activate`                                                                  |
| `type "vector" does not exist`   | The database volume predates the pgvector setup. `pnpm docker:down`, delete the volume, then `pnpm docker:db && pnpm db:push`. |
| `db: "missing"` in `/api/health` | Postgres is not running. `pnpm docker:db`.                                                                                     |
| Port 3000 already in use         | Another dev server is running. Stop it, or `PORT=3001 pnpm dev`.                                                               |
| Anything else                    | `pnpm doctor`                                                                                                                  |

---

# 한국어

## 빠른 시작

**설치해야 하는 것은 셋뿐이다** — Node.js, pnpm, Docker. 나머지는 아래 명령이
전부 해결한다. 셋 다 없다면 [사전 준비](#사전-준비)부터 본다.

```bash
git clone https://github.com/Samin-Queue/antelope.git
cd antelope

pnpm install                   # 의존성 설치 + git 훅 설정
cp .env.example .env.local     # 그다음 값을 채운다 — "환경변수" 참고
pnpm docker:db                 # Docker 로 PostgreSQL 기동
pnpm db:push                   # 테이블 생성
pnpm dev                       # http://localhost:3000
```

http://localhost:3000 이 열리면 실행된 것이다.

> **`.env.local` 이 비어 있어도 앱은 뜬다.** 실제로 파일을 비우고 확인했다 —
> `/`, `/demo`, `/demo/hiring`, `/demo/hiring/apply`, `/lab`, `/playground` 가 전부
> 200 이다. 키를 넣을수록 기능이 켜지고, 어떤 키가 무엇을 여는지는 아래 표에 있다.

### 사전 준비

| 도구        | 버전                             | 설치 방법                                                                                                                                                          |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Node.js** | 24.2.0 (`.nvmrc` 에 고정)        | [nvm](https://github.com/nvm-sh/nvm) 을 쓰면 레포 루트에서 `nvm install` 만으로 `.nvmrc` 를 읽어 맞춰준다. 또는 [nodejs.org](https://nodejs.org) 에서 직접 받는다. |
| **pnpm**    | 10.12.3 (`package.json` 에 고정) | `corepack enable && corepack prepare pnpm@10.12.3 --activate` — Corepack 은 Node 에 함께 들어 있다.                                                                |
| **Docker**  | 최신 아무 버전                   | [Docker Desktop](https://www.docker.com/products/docker-desktop/). 로컬 데이터베이스에만 필요하다.                                                                 |

언제든 `pnpm doctor` 를 돌리면 무엇이 빠졌고 어떻게 고치는지 알려준다.

**아무것도 설치하기 싫다면** VS Code 나 Cursor 에서 레포를 열고 **Reopen in
Container** 를 고른다. devcontainer 가 Node·pnpm·데이터베이스·CLI 를 전부 들고
온다. Docker 는 여전히 필요하다.

## 환경변수

`.env.example` 을 `.env.local` 로 복사하고 필요한 값만 채운다. **실행에 반드시
필요한 값은 없다** — 키마다 여는 기능이 다를 뿐이다.

`.env.local` 은 `.gitignore` 에 들어 있다. 절대 커밋하지 않는다.

### 가장 중요한 둘

| 변수              | 여는 기능                              | 발급처                                                                                                                |
| ----------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `UPSTAGE_API_KEY` | 채팅·문서 파싱·임베딩. 제품의 핵심이다 | [console.upstage.ai](https://console.upstage.ai) 가입 → **API Keys** → 생성. `up_` 으로 시작한다. 무료 크레딧이 있다. |
| `DATABASE_URL`    | 지식베이스·문서 저장·벡터 검색         | 로컬 Docker 용 값이 `.env.example` 에 이미 들어 있다. `pnpm docker:db` 만 돌리면 된다.                                |

이 둘이면 OAuth 로그인과 데모 메일을 뺀 전부가 동작한다.

### 나머지

| 변수                                         | 기본값                  | 비우면                                                                                                                                                                                                 |
| -------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LLM_PROVIDER`                               | `upstage`               | 모델 프로바이더를 바꾼다. `upstage`·`azure`·`backendai`·`openai`·`custom`.                                                                                                                             |
| `LLM_MODEL` · `LLM_BASE_URL` · `LLM_API_KEY` | —                       | 프리셋을 덮어쓴다. 필요한 이유를 모르면 비워둔다.                                                                                                                                                      |
| `UPSTAGE_AGENT_ID`                           | —                       | Studio 에이전트 파이프라인 대신 Upstage v1 REST 를 직접 호출한다. 앱은 그대로 동작한다.                                                                                                                |
| `AZURE_API_KEY` · `AZURE_BASE_URL`           | —                       | `LLM_PROVIDER=azure` 일 때만 필요하다. base URL 은 신형 v1 경로여야 하고(`https://<resource>.services.ai.azure.com/openai/v1`), `LLM_MODEL` 에는 모델 id 가 아니라 **배포(deployment) 이름**을 넣는다. |
| `BACKENDAI_API_KEY` · `BACKENDAI_BASE_URL`   | —                       | `LLM_PROVIDER=backendai` 전용.                                                                                                                                                                         |
| `OPENAI_API_KEY`                             | —                       | `LLM_PROVIDER=openai` 전용.                                                                                                                                                                            |
| `BETTER_AUTH_SECRET`                         | —                       | 로그인이 꺼진다. `openssl rand -base64 32` 로 만든다.                                                                                                                                                  |
| `BETTER_AUTH_URL`                            | `http://localhost:3000` | 실제로 접속하는 origin 과 같아야 한다.                                                                                                                                                                 |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET`  | —                       | 구글 버튼이 아예 그려지지 않는다. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 에서 발급하고, 콜백 URL 은 `{origin}/api/auth/callback/google`.                            |
| `GITHUB_CLIENT_ID` · `GITHUB_CLIENT_SECRET`  | —                       | 깃허브 버튼이 그려지지 않는다. [github.com/settings/developers](https://github.com/settings/developers) 에서 OAuth App 을 만들고, 콜백 URL 은 `{origin}/api/auth/callback/github`.                     |

### 데모 메일 (선택)

`/demo` 아래 가상 신청 사이트들이 SMTP 로 **실제 인증코드와 면접 일정 메일**을
보낸다.

| 변수                      | 설명                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SMTP_HOST` · `SMTP_PORT` | `smtp.gmail.com`, `465` 가 미리 채워져 있다.                                                                                                      |
| `SMTP_USER`               | 본인 Gmail 주소.                                                                                                                                  |
| `SMTP_PASSWORD`           | 로그인 비밀번호가 아니라 **앱 비밀번호**다. 구글 계정 → 보안 → 2단계 인증 켜기 → 앱 비밀번호 → 16자리 발급. 공백 없이 입력한다.                   |
| `SMTP_FROM_NAME`          | 발신자 표시 이름.                                                                                                                                 |
| `DEMO_MAIL_ALLOWLIST`     | 비우면 누구에게나 발송된다. `me@example.com,@yourdomain.com` 처럼 넣으면 그 대상에게만 나간다. 레이트 리밋(IP 5회·주소 3회/10분)은 항상 적용된다. |

비워두면 개발 환경에서는 흐름이 끊기지 않는다 — 코드가 API 응답에 실려 화면에
경고와 함께 표시된다. 프로덕션에서는 조용히 통과시키지 않고 **503 으로 실패**한다.

## 동작 확인

```bash
curl http://localhost:3000/api/health
```

**아직 API 키가 없을 때** — 갓 클론한 상태에서 나오는 응답이고, 정상이다.

```json
{
  "ok": true,
  "db": "configured",
  "llm": { "error": "[llm] upstage: API key 미설정 (LLM_API_KEY)" }
}
```

**`UPSTAGE_API_KEY` 를 넣은 뒤:**

```json
{
  "ok": true,
  "db": "configured",
  "llm": { "provider": "upstage", "model": "solar-pro4" }
}
```

`"db": "missing"` 은 `DATABASE_URL` 이 없거나 Postgres 가 안 떠 있다는 뜻이다.
데이터베이스가 필요 없는 화면은 전부 그대로 동작한다.

## 둘러볼 곳

| 경로          | 내용                                                                                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`           | 랜딩. 모든 문구는 `src/content/site.ts` 한 파일에 있다.                                                                                                                                                                                                         |
| `/app`        | 제품 본체 — 문서, 지식베이스, 플레이그라운드.                                                                                                                                                                                                                   |
| `/demo`       | 에이전트를 끝까지 검증하려고 만든 가상 신청 사이트 7종. 각각 공고문과 신청 폼을 갖고, 폼마다 방식이 다르다 — 다단계 위저드, 행 동적 추가, 캐스케이딩 선택, 드래그앤드롭 업로드, HWP 지정서식 왕복, 회원가입·로그인 게이트. 어느 내비게이션에도 링크되지 않는다. |
| `/lab`        | 병렬 실험. 점선 배너가 붙어 프로덕션과 혼동되지 않는다.                                                                                                                                                                                                         |
| `/api/health` | 프로바이더·모델·DB 상태.                                                                                                                                                                                                                                        |

## 명령

```bash
pnpm dev            # 개발 서버
pnpm build          # 프로덕션 빌드 (타입체크 포함)
pnpm typecheck      # 타입만
pnpm lint
pnpm format         # Prettier 일괄 적용
pnpm format:check   # CI 와 동일한 검사

pnpm docker:db      # PostgreSQL 만
pnpm docker:up      # app + PostgreSQL
pnpm docker:prod    # 프로덕션 이미지를 로컬에서 실행
pnpm docker:down

pnpm db:push        # 스키마 반영
pnpm db:studio      # 데이터베이스 탐색

pnpm doctor         # 환경이 이상할 때
```

## 문제 해결

| 증상                             | 해결                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm: command not found`        | `corepack enable && corepack prepare pnpm@10.12.3 --activate`                                                 |
| `type "vector" does not exist`   | pgvector 설정 이전에 만들어진 볼륨이다. `pnpm docker:down` 후 볼륨을 지우고 `pnpm docker:db && pnpm db:push`. |
| `/api/health` 가 `db: "missing"` | Postgres 가 안 떠 있다. `pnpm docker:db`.                                                                     |
| 3000 포트 사용 중                | 다른 개발 서버가 떠 있다. 끄거나 `PORT=3001 pnpm dev`.                                                        |
| 그 외                            | `pnpm doctor`                                                                                                 |

---

# Open Source

**오픈소스 고지**

Antelope is built on the following open-source projects. Every direct dependency is
listed with its license.
Antelope 는 아래 오픈소스 위에 만들어졌다. 모든 직접 의존성을 라이선스와 함께 밝힌다.

### Core stack · 핵심 스택

| Project                                                                  | License          | Role                                    |
| ------------------------------------------------------------------------ | ---------------- | --------------------------------------- |
| [Next.js](https://github.com/vercel/next.js)                             | MIT              | React framework (App Router, Turbopack) |
| [React](https://github.com/facebook/react) · React DOM                   | MIT              | UI runtime                              |
| [TypeScript](https://github.com/microsoft/TypeScript)                    | Apache-2.0       | Language                                |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss)              | MIT              | Styling                                 |
| [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) · Drizzle Kit | Apache-2.0 / MIT | Database access and migrations          |
| [postgres](https://github.com/porsager/postgres)                         | Unlicense        | PostgreSQL driver                       |
| [Vercel AI SDK](https://github.com/vercel/ai) (`ai`, `@ai-sdk/*`)        | Apache-2.0       | LLM streaming and provider adapters     |
| [better-auth](https://github.com/better-auth/better-auth)                | MIT              | Authentication                          |
| [Playwright](https://github.com/microsoft/playwright)                    | Apache-2.0       | Browser automation                      |
| [nodemailer](https://github.com/nodemailer/nodemailer)                   | MIT-0            | SMTP delivery                           |
| [Zod](https://github.com/colinhacks/zod)                                 | MIT              | Schema validation                       |

### UI · 인터페이스

| Project                                                                                                                                                            | License                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| [shadcn/ui](https://github.com/shadcn-ui/ui)                                                                                                                       | MIT                    |
| [Base UI](https://github.com/mui/base-ui) (`@base-ui/react`)                                                                                                       | MIT                    |
| [Lucide](https://github.com/lucide-icons/lucide) (`lucide-react`)                                                                                                  | ISC                    |
| [TanStack Query](https://github.com/TanStack/query)                                                                                                                | MIT                    |
| [Sonner](https://github.com/emilkowalski/sonner)                                                                                                                   | MIT                    |
| [next-themes](https://github.com/pacocoursey/next-themes)                                                                                                          | MIT                    |
| [react-markdown](https://github.com/remarkjs/react-markdown) · [remark-gfm](https://github.com/remarkjs/remark-gfm)                                                | MIT                    |
| [clsx](https://github.com/lukeed/clsx) · [tailwind-merge](https://github.com/dcastil/tailwind-merge) · [class-variance-authority](https://github.com/joe-bell/cva) | MIT / MIT / Apache-2.0 |
| [tw-animate-css](https://github.com/Wombosvideo/tw-animate-css)                                                                                                    | MIT                    |

### Tooling · 개발 도구

| Project                                                                                      | License      |
| -------------------------------------------------------------------------------------------- | ------------ |
| [ESLint](https://github.com/eslint/eslint) · eslint-config-next · eslint-config-prettier     | MIT          |
| [Prettier](https://github.com/prettier/prettier) · prettier-plugin-tailwindcss               | MIT          |
| [@ianvs/prettier-plugin-sort-imports](https://github.com/IanVS/prettier-plugin-sort-imports) | Apache-2.0   |
| [tsx](https://github.com/privatenumber/tsx)                                                  | MIT          |
| [dotenv](https://github.com/motdotla/dotenv)                                                 | BSD-2-Clause |
| [@types/*](https://github.com/DefinitelyTyped/DefinitelyTyped)                               | MIT          |

### Fonts · 글꼴

| Font                                                       | License                   |
| ---------------------------------------------------------- | ------------------------- |
| [Pretendard](https://github.com/orioncactus/pretendard)    | SIL Open Font License 1.1 |
| [Diphylleia](https://fonts.google.com/specimen/Diphylleia) | SIL Open Font License 1.1 |
| [Geist](https://github.com/vercel/geist-font) · Geist Mono | SIL Open Font License 1.1 |

### Services · 외부 서비스

Not open source, but the project depends on them at runtime.
오픈소스는 아니지만 실행에 관여한다.

| Service                                                                                      | Used for                                                                                          |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Upstage](https://upstage.ai)                                                                | Solar chat models, Document Parse / OCR / Information Extract, embeddings, Studio document agents |
| [PostgreSQL](https://www.postgresql.org/) + [pgvector](https://github.com/pgvector/pgvector) | Database and vector search (PostgreSQL License / PostgreSQL License)                              |
| [Railway](https://railway.app)                                                               | Deployment                                                                                        |

License summary across all direct dependencies:
전체 직접 의존성의 라이선스 분포:

**MIT 29 · Apache-2.0 9 · ISC 1 · MIT-0 1 · Unlicense 1 · BSD-2-Clause 1**

---

## More documentation · 문서 더 보기

- [SETUP.md](./SETUP.md) — detailed desktop setup / 데스크톱 세팅 상세
- [AGENTS.md](./AGENTS.md) — working rules, architecture decisions, and the list of
  settings that must not be deleted / 작업 규칙, 아키텍처 결정, **지우면 안 되는 설정 목록**
- [docs/upstage-studio.md](./docs/upstage-studio.md) — Upstage Studio API guide / Studio 활용 가이드
