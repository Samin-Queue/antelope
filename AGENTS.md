# Antelope

|      |                                                  |
| ---- | ------------------------------------------------ |
| 제품 | **Antelope**                                     |
| 레포 | https://github.com/Samin-Queue/antelope          |
| 배포 | https://web-production-3f8f1.up.railway.app      |

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
- **pgvector 0.8.6 사용 가능**. RAG 가 필요하면 `CREATE EXTENSION vector` 후
  Upstage `solar-embedding-2-*` 와 붙인다.
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

## 규칙

- 랜딩 문구는 전부 `src/content/site.ts` 에. 컴포넌트에 문자열을 박지 않는다.
- UI 프리미티브는 `src/components/ui/*`. 직접 만들기 전에
  `pnpm dlx shadcn@latest add <name>` 부터.
- 이 스타일의 `Button` 은 `asChild` 가 아니라 base-ui `render` prop 을 쓴다:
  `<Button render={<Link href="/x" />}>`.
- 저장하면 Prettier 가 포맷한다. 손으로 정렬하지 않는다 — Tailwind 클래스 순서와
  import 순서까지 플러그인이 맞춘다. CI 가 `format:check` 로 막는다.
- 커밋 전 `pnpm build` — 타입체크가 빌드에 포함되어 있다.

## 지우면 안 되는 것들

전부 한 번씩 실제로 깨져서 고친 것들이다.

| 위치                           | 무엇                                                            | 지우면                                                                                                         |
| ------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                   | `pnpm config set node-linker hoisted`                           | pnpm 심볼릭 링크 레이아웃을 Next standalone 트레이싱이 못 따라가 `@swc/helpers` 누락 → 런타임 MODULE_NOT_FOUND |
| `Dockerfile`                   | BuildKit 지시자(`# syntax`, `--mount=type=cache`) **없는** 상태 | Railway Metal 빌더가 빈 로그로 FAILED. 다시 넣지 말 것                                                         |
| Railway 변수                   | `PORT=3000`                                                     | Railway 기본값 8080 과 도메인 타깃 포트(3000)가 어긋나 502                                                     |
| `public/.gitkeep`              | 빈 디렉터리 유지                                                | git 이 빈 디렉터리를 추적하지 않아 fresh clone 에서 `COPY /app/public` 이 not found                            |
| `drizzle.config.ts`            | `config({ path: ".env.local" })`                                | dotenv 기본값은 `.env` 인데 Next 는 `.env.local` 을 쓴다 → `db:push` 가 DATABASE_URL 을 못 찾음                |
| `.devcontainer/post-create.sh` | `--config.confirmModulesPurge=false`                            | pnpm 이 "reinstall from scratch? (Y/n)" 를 띄우고 비대화형에서 응답이 안 돼 postCreate 무한 대기               |
| `.devcontainer/compose.yaml`   | `NODE_ENV: ""`                                                  | Dockerfile dev 타깃의 `NODE_ENV=development` 상태로 `pnpm build` 하면 React 가 dev/prod 로 갈려 프리렌더 깨짐  |

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
