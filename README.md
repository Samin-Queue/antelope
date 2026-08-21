# Antelope

JunctionX Korea 2026 (포항, 8/21–8/23) 출품작 · Team **Samin Queue**

배포: https://web-production-3f8f1.up.railway.app

## 시작하기

처음이라면 [SETUP.md](./SETUP.md) 를 먼저 본다 — Node·pnpm·Docker·git 신원까지 한 번에 정리돼 있다.

```bash
pnpm install
cp .env.example .env.local     # UPSTAGE_API_KEY 를 채운다
pnpm docker:db                 # 로컬 Postgres
pnpm db:push                   # 스키마 반영
pnpm dev                       # http://localhost:3000
```

`/api/health` 가 200 이고 `llm.provider` 가 보이면 준비 완료.
막히면 `pnpm doctor` 가 무엇이 빠졌는지 알려준다.

Cursor/VS Code 에서 `Reopen in Container` 로 devcontainer 를 써도 된다 —
결과는 같고, macOS 에서는 위쪽(네이티브)이 더 빠르다.

## 화면

| 경로            | 용도                                                |
| --------------- | --------------------------------------------------- |
| `/`             | 랜딩. 문구는 `src/content/site.ts` 한 파일에서 관리 |
| `/playground`   | LLM 연결을 눈으로 확인하는 스트리밍 채팅            |
| `/api/health`   | 프로바이더·모델·DB 상태                             |
| `/api/chat`     | 채팅 스트리밍                                       |
| `/api/document` | 파일 업로드 → Upstage Document Parse                |

## 스택

Next.js 16 · TypeScript · Tailwind v4 · shadcn/ui · Drizzle + Postgres(pgvector) ·
Vercel AI SDK v7 · Docker · Railway

`main` 에 푸시하면 GitHub Actions 가 검증하고 Railway 가 자동 배포한다.

## 문서

- [SETUP.md](./SETUP.md) — 데스크톱 세팅. 팀에서 받을 것은 `.env.local` 하나뿐이다.
- [AGENTS.md](./AGENTS.md) — 작업 규칙, 트랙 스위칭, **지우면 안 되는 설정 목록**.
  처음 합류했다면 한 번 읽고 시작할 것.
