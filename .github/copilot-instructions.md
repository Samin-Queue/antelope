이 저장소의 작업 규칙은 루트 `AGENTS.md` 에 있다. 코드를 만지기 전에 그 파일의
"에이전트에게" 섹션과 "지우면 안 되는 것들" 표를 읽는다.

- 실험 코드는 `src/app/(labs)/lab/<slug>/` 안에만 둔다. `src/lib/*` 를 고치지 않는다.
- 랜딩 문구는 `src/content/site.ts` 에만 둔다.
- `Button` 은 `asChild` 가 아니라 base-ui `render` prop 을 쓴다.
- DB 접근은 `getDb()` 로 한다.
- 커밋 이메일은 저장소 `git config` 값을 그대로 쓴다.
- 작업 전 `git pull`, 작업 후 `pnpm build`.
