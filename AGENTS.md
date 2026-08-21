# Samin Queue

## 스택

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · shadcn/ui(base-nova, base-ui)
· Drizzle + Postgres · Vercel AI SDK v7 · Docker · Railway 배포.

레포: https://github.com/Samin-Queue/samin-queue

## 트랙 스위칭

`src/lib/llm.ts` 가 모든 파트너 API 를 OpenAI 호환 인터페이스로 추상화한다.
트랙이 정해지면 **환경변수만** 바꾼다 — 애플리케이션 코드는 건드리지 않는다.

```bash
LLM_PROVIDER=upstage    # api.upstage.ai/v1, solar-pro4
LLM_PROVIDER=azure      # AZURE_BASE_URL + AZURE_API_KEY
LLM_PROVIDER=backendai  # BACKENDAI_BASE_URL + BACKENDAI_API_KEY
```

`/api/health` 가 현재 붙은 프로바이더·모델·DB 상태를 반환한다. `/playground` 는 그 연결을 눈으로 확인하는 채팅 UI.

## 규칙

- 랜딩 문구는 전부 `src/content/site.ts` 한 파일에. 컴포넌트에 문자열을 박지 않는다.
- UI 프리미티브는 `src/components/ui/*` (shadcn). 직접 만들기 전에 `pnpm dlx shadcn@latest add <name>` 부터.
- 이 스타일의 `Button` 은 `asChild` 가 아니라 base-ui `render` prop 을 쓴다: `<Button render={<Link href="/x" />}>`.
- DB 접근은 `getDb()` 로. `DATABASE_URL` 없이도 앱이 떠야 한다 (랜딩·데모는 DB 무관).
- 커밋 전 `pnpm build` — 타입체크가 빌드에 포함되어 있다.

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
railway up            # 수동 배포 (기본은 GitHub push 자동 배포)
```
