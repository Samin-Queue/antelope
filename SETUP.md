# 개발 환경 세팅

각자 데스크톱에서 한 번만 하면 된다. 다 끝나면 `pnpm doctor` 가 전부 ✓ 여야 한다.

**팀에서 받아야 하는 것은 `.env.local` 파일 하나뿐이다.** 나머지는 전부 아래 명령으로 해결된다.

---

## 0. 미리 받아둘 것

| 항목            | 어디서                                                                     |
| --------------- | -------------------------------------------------------------------------- |
| `.env.local`    | 팀 채널에서 받는다. **레포에 커밋하지 않는다** (`.gitignore` 에 이미 있다) |
| GitHub org 초대 | `Samin-Queue` org 초대 수락                                                |

---

## 1. Node 24 + pnpm

레포에 `.nvmrc`(Node 버전)와 `packageManager`(pnpm 버전)가 박혀 있다. 그대로 맞춘다.

**macOS / Linux**

```bash
# nvm 이 없다면
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
exec $SHELL -l

nvm install        # .nvmrc 를 읽어 그 버전을 설치한다
nvm use

corepack enable    # pnpm 을 Node 에 딸린 corepack 으로 관리한다
```

**Windows**

```powershell
winget install CoreyButler.NVMforWindows
nvm install 24
nvm use 24
corepack enable
```

확인:

```bash
node -v    # v24.x
pnpm -v    # 10.12.3
```

---

## 2. Docker

로컬 Postgres 를 띄우는 데 쓴다. 프로덕션과 **같은 이미지**를 써서 확장 구성이 어긋나지 않는다.

- macOS / Windows: [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치 후 **실행**
- Linux: `sudo apt install docker.io docker-compose-plugin` 후 `sudo usermod -aG docker $USER` (재로그인 필요)

확인: `docker info` 가 에러 없이 나오면 된다.

---

## 3. git 신원

**이걸 안 하면 커밋이 엉뚱한 계정으로 귀속된다.** GitHub 계정에 등록된 이메일을 쓴다.

```bash
git config --global user.name "본인 이름"
git config --global user.email "GitHub 에 등록된 이메일"
```

GitHub 이 어떤 이메일을 인식하는지는 https://github.com/settings/emails 에서 확인한다.
공개하기 싫으면 같은 페이지의 `noreply` 주소를 쓴다.

---

## 4. 클론 후 실행

```bash
gh repo clone Samin-Queue/antelope    # 또는: git clone https://github.com/Samin-Queue/antelope.git
cd antelope

pnpm install                          # pre-push 훅도 여기서 자동 설정된다

# 받은 .env.local 을 레포 루트에 둔다. 없으면 예시로 시작:
#   cp .env.example .env.local

pnpm docker:db                        # 로컬 Postgres
pnpm db:push                          # 스키마 반영
pnpm doctor                           # 전부 ✓ 인지 확인
pnpm dev                              # http://localhost:3000
```

`/api/health` 가 200 이고 `llm.provider` 가 보이면 준비 완료다.

---

## 5. 에디터 (선택)

VS Code / Cursor 는 레포의 `.vscode/extensions.json` 을 보고 확장 설치를 권한다. 수락하면 된다.

- **Prettier** — 저장 시 자동 포맷. 손으로 정렬하지 않는다
- **ESLint**, **Tailwind CSS IntelliSense**

컨테이너 안에서 개발하고 싶으면 `Reopen in Container` 를 쓴다(선택). macOS 에서는
호스트에서 `pnpm dev` 를 돌리는 쪽이 파일 감시가 빨라 기본 경로로 둔다.

---

## 자주 걸리는 것

| 증상                                        | 원인 · 해결                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm db:push` 가 DATABASE_URL 을 못 찾는다 | `.env.local` 이 없거나 값이 비었다. `pnpm doctor` 로 확인                                                 |
| `type "vector" does not exist`              | DB 볼륨을 지우고 다시 만들었는데 초기화 스크립트가 안 돈 경우. `docker compose down -v && pnpm docker:db` |
| 포트 5432 가 이미 사용 중                   | 로컬에 다른 Postgres 가 떠 있다. 끄거나 `compose.yaml` 의 포트를 바꾼다                                   |
| `git push` 가 pre-push 에서 막힌다          | format·lint·typecheck 중 하나가 실패했다. 메시지대로 고친다. 정말 급하면 `git push --no-verify`           |
| 커밋이 다른 계정으로 표시된다               | 3번(git 신원)을 안 했다. 이미 커밋했다면 팀에 알린다 — 히스토리 재작성이 필요하다                         |
| 로그인 버튼이 안 보인다                     | `.env.local` 에 해당 프로바이더 키가 없다. 키가 없는 프로바이더는 버튼 자체가 숨겨진다                    |
| Docker 명령이 안 먹는다                     | Docker Desktop 이 실행 중이 아니다                                                                        |

---

## 우리가 안 하는 것

- **Railway 계정** — 필요 없다. `main` 에 푸시하면 자동 배포되고, 빌드 결과는
  GitHub Actions 탭에서 본다. 프로덕션 로그·환경변수·롤백만 계정 소유자를 거친다.
- **개별 API 키 발급** — `.env.local` 에 팀 공용 키가 들어 있다.
- **pre-push 훅 수동 설정** — `pnpm install` 이 `core.hooksPath` 를 잡아준다.

작업 규칙과 아키텍처는 [AGENTS.md](./AGENTS.md) 를 본다.
