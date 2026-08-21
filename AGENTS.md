# Samin Queue

## 스택

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · shadcn/ui(base-nova, base-ui)
· Drizzle + Postgres · Vercel AI SDK v7 · Docker · Railway 배포.

레포: https://github.com/Samin-Queue/samin-queue

## 트랙 스위칭

`src/lib/llm.ts` 가 모든 파트너 API 를 OpenAI 호환 인터페이스로 추상화한다.
트랙이 정해지면 **환경변수만** 바꾼다 — 애플리케이션 코드는 건드리지 않는다.

```bash
LLM_PROVIDER=upstage    # api.upstage.ai/v1 · solar-pro4 (solar-pro3/pro2/mini 도 가용)
LLM_PROVIDER=azure      # AZURE_BASE_URL + AZURE_API_KEY
```

Azure 는 두 가지가 다르다.

- **신형 v1 경로만 지원한다** — `https://<resource>.services.ai.azure.com/openai/v1`.
  레거시 `/openai/deployments/<name>/chat/completions?api-version=...` 은 규격이 달라
  붙지 않는다.
- **인증이 `api-key` 헤더다** (Bearer 아님). 어댑터가 두 헤더를 모두 보낸다.
- `LLM_MODEL` 에는 모델 id 가 아니라 **배포(deployment) 이름**을 넣는다.

`/api/health` 가 현재 붙은 프로바이더·모델·DB 상태를 반환한다. `/playground` 는 그 연결을 눈으로 확인하는 채팅 UI.

## 규칙

- 랜딩 문구는 전부 `src/content/site.ts` 한 파일에. 컴포넌트에 문자열을 박지 않는다.
- UI 프리미티브는 `src/components/ui/*` (shadcn). 직접 만들기 전에 `pnpm dlx shadcn@latest add <name>` 부터.
- 이 스타일의 `Button` 은 `asChild` 가 아니라 base-ui `render` prop 을 쓴다: `<Button render={<Link href="/x" />}>`.
- DB 접근은 `getDb()` 로. `DATABASE_URL` 없이도 앱이 떠야 한다 (랜딩·데모는 DB 무관).
- 커밋 전 `pnpm build` — 타입체크가 빌드에 포함되어 있다.
- 저장하면 Prettier 가 포맷한다(`.vscode/settings.json`). 손으로 정렬하지 않는다 —
  Tailwind 클래스 순서와 import 순서까지 플러그인이 맞춘다. CI 가 `format:check` 로 막는다.
- DB 는 pgvector 를 쓸 수 있다(로컬·프로덕션 동일 이미지, vector 0.8.6).
  임베딩이 필요하면 `CREATE EXTENSION vector` 후 Upstage `solar-embedding-2-*` 를 쓴다.

## Railway 계정 없이 협업하기

Railway 는 Hobby 플랜이라 워크스페이스 멤버 초대가 안 된다. 그래도 세 명이
막히지 않는 이유:

- **배포** — `main` 에 푸시하면 Railway 가 자동 빌드한다. Railway 계정 불필요.
- **검증** — `.github/workflows/ci.yml` 이 push·PR 마다 lint / build / docker build 를
  돌린다. 내 코드가 깨졌는지는 GitHub Actions 탭에서 직접 본다.
- **로컬 DB** — `pnpm docker:up` 으로 각자 Postgres 를 띄운다. 프로덕션 DB 공유 안 함.
- **키** — `.env.local` 로 전달받는다. 레포에 커밋하지 않는다.

Railway 콘솔이 있어야만 되는 일은 셋뿐이다 — 프로덕션 로그 열람, 환경변수 변경,
롤백. 이건 계정 소유자를 거친다.

## Railway — 배포와 환경변수

워크스페이스 `Samin Queue` · 프로젝트 `samin-queue` · 서비스 `web`(GitHub 연동) + `Postgres`.
`main` 에 푸시하면 Dockerfile 로 빌드되어 자동 배포된다.

- 배포 URL: https://web-production-3f8f1.up.railway.app
- `DATABASE_URL` 은 `${{Postgres.DATABASE_URL}}` 참조로 연결됨 — 직접 값을 넣지 말 것.
- `PORT=3000` 을 서비스 변수로 고정했다. Railway 기본값은 8080 이라 도메인
  타깃 포트(3000)와 어긋나 502 가 난다. 지우지 말 것.

환경변수는 Railway 가 단일 소스다. 로컬에서도 같은 값을 끌어다 쓴다.

```bash
railway link                                    # 최초 1회, 디렉터리를 프로젝트에 연결
railway variable set UPSTAGE_API_KEY=... --skip-deploys
railway variable list --kv                      # 현재 값 확인
railway run pnpm dev                            # Railway 변수로 로컬 실행 (.env.local 불필요)
railway logs --service web                      # 배포 로그
```

현재 플랜(Hobby)에서는 워크스페이스 멤버 초대가 안 된다. 팀원이 Railway 를 직접
봐야 하면 Pro 로 올려야 하고, 그때까지는 키를 별도로 전달한다.

## 제품명이 정해지면

`samin-queue` 는 팀 이름이다. 제품명은 별개이고, 바꿔야 하는 곳은 두 군데뿐이다.

```bash
# 1. 랜딩·메타데이터 (site.name 한 줄)
#    src/content/site.ts → name: "새제품명"

# 2. GitHub 레포 이름 (옛 URL 은 GitHub 이 리다이렉트하므로 clone·remote 안 깨짐)
gh repo rename <new-name> --repo Samin-Queue/samin-queue
git remote set-url origin https://github.com/Samin-Queue/<new-name>.git
```

`package.json` 의 name, compose 프로젝트명, Postgres DB 이름, 도커 이미지 태그는
팀 단위 식별자라 그대로 둔다 — 바꾸면 로컬 볼륨과 DB 가 새로 만들어진다.

## Docker — 3명이 같은 환경을 쓴다

`Dockerfile` 하나를 개발·배포가 공유한다. Railway 도 이 Dockerfile 로 빌드하므로
로컬에서 도는 이미지가 곧 프로덕션 이미지다.

```bash
pnpm docker:up      # app(핫리로드) + postgres 전체 기동 → localhost:3000
pnpm docker:db      # DB 만 띄우고 앱은 호스트에서 pnpm dev (macOS 에서 가장 빠름)
pnpm docker:prod    # 프로덕션 이미지를 로컬에서 그대로 실행
pnpm docker:down    # 정리
```

- 컨테이너 안 `DATABASE_URL` 은 `postgres://postgres:postgres@db:5432/samin_queue`.
  호스트에서 붙을 땐 `@localhost:5432`.
- API 키 등은 `.env.local` 에 두면 compose 가 자동으로 읽는다 (없어도 기동됨).
- Dockerfile 은 컨테이너 안에서만 pnpm `node-linker=hoisted` 를 쓴다.
  pnpm 심볼릭 링크 레이아웃이 Next standalone 트레이싱에서 `@swc/helpers` 를
  누락시켜 런타임에 MODULE_NOT_FOUND 가 나기 때문. 지우지 말 것.

## 명령

```bash
pnpm dev              # 로컬 개발
pnpm build            # 타입체크 + 프로덕션 빌드
pnpm db:push          # 스키마를 DB 에 반영 (마이그레이션 파일 없이, 해커톤용)
pnpm db:studio        # Drizzle Studio
pnpm format           # Prettier 일괄 적용
pnpm typecheck        # 빌드 없이 타입만
railway up            # 수동 배포 (기본은 GitHub push 자동 배포)
```
