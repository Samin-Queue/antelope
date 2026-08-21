# Samin Queue — JunctionX Korea 2026

포항 · 2026-08-21 ~ 08-23 · 3인 팀.
트랙은 8/21 20:00 현장 발표. 그 전까지는 트랙 무관 인프라만 만든다.

## 일정 (KST)

| 시각 | 항목 |
|---|---|
| 8/21 20:00 | 트랙 발표 |
| 8/21 21:00 | 트랙 파트너 워크숍 |
| 8/22 00:00 | **Mission 1 제출** (컨셉) |
| 8/23 00:00 | **Mission 2 제출** (MVP) |
| 8/23 12:00 | **Mission 3 제출** (최종) |
| 8/23 13:00 | Demo Expo |
| 8/23 16:00 | Final Pitch |

## 스택

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · shadcn/ui(base-nova, base-ui)
· Drizzle + Postgres · Vercel AI SDK v7 · Railway 배포.

## 트랙 스위칭

`src/lib/llm.ts` 가 모든 파트너 API 를 OpenAI 호환 인터페이스로 추상화한다.
트랙이 정해지면 **환경변수만** 바꾼다 — 애플리케이션 코드는 건드리지 않는다.

```bash
LLM_PROVIDER=upstage    # api.upstage.ai/v1, solar-pro2
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

## 명령

```bash
pnpm dev              # 로컬 개발
pnpm build            # 타입체크 + 프로덕션 빌드
pnpm db:push          # 스키마를 DB 에 반영 (마이그레이션 파일 없이, 해커톤용)
pnpm db:studio        # Drizzle Studio
railway up            # 수동 배포 (기본은 GitHub push 자동 배포)
```
