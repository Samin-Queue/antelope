/**
 * 로컬 환경이 개발 가능한 상태인지 한 번에 점검한다.
 * 팀원이 처음 세팅할 때, 그리고 "왜 안 되지" 싶을 때 먼저 돌린다.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";

type Result = { ok: boolean; label: string; detail: string; fix?: string };

const results: Result[] = [];

function push(ok: boolean, label: string, detail: string, fix?: string) {
  results.push({ ok, label, detail, fix });
}

function run(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

// ── Node ────────────────────────────────────────────────────────────────
const wanted = existsSync(".nvmrc") ? readFileSync(".nvmrc", "utf8").trim() : "24";
const major = Number(process.versions.node.split(".")[0]);
const wantedMajor = Number(wanted.split(".")[0]);
push(
  major >= wantedMajor,
  "Node",
  `${process.versions.node} (필요: ${wantedMajor} 이상)`,
  `nvm install ${wanted} && nvm use ${wanted}`,
);

// ── pnpm ────────────────────────────────────────────────────────────────
const pnpmVersion = run("pnpm", ["--version"]);
push(
  pnpmVersion !== null,
  "pnpm",
  pnpmVersion ?? "설치되지 않음",
  "corepack enable && corepack prepare pnpm@10.12.3 --activate",
);

// ── Docker ──────────────────────────────────────────────────────────────
const dockerVersion = run("docker", ["--version"]);
const dockerRunning = run("docker", ["info", "--format", "{{.ServerVersion}}"]);
push(
  dockerRunning !== null,
  "Docker",
  dockerRunning
    ? `엔진 ${dockerRunning}`
    : dockerVersion
      ? "설치됨 · 데몬이 꺼져 있음"
      : "설치되지 않음",
  "Docker Desktop 을 설치하고 실행한다",
);

// ── git 신원 ─────────────────────────────────────────────────────────────
const gitEmail = run("git", ["config", "user.email"]);
const gitName = run("git", ["config", "user.name"]);
push(
  Boolean(gitEmail && gitName),
  "git 신원",
  gitEmail && gitName ? `${gitName} <${gitEmail}>` : "설정되지 않음",
  'git config --global user.name "이름" && git config --global user.email "GitHub 계정 이메일"',
);

// ── pre-push 훅 ──────────────────────────────────────────────────────────
const hooksPath = run("git", ["config", "core.hooksPath"]);
push(
  hooksPath === ".githooks",
  "pre-push 훅",
  hooksPath ?? "미설정",
  "pnpm install (prepare 스크립트가 자동으로 잡는다)",
);

// ── .env.local ──────────────────────────────────────────────────────────
const REQUIRED = ["DATABASE_URL", "UPSTAGE_API_KEY", "BETTER_AUTH_SECRET"];
const OPTIONAL = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
];

if (!existsSync(".env.local")) {
  push(false, ".env.local", "파일 없음", "팀에서 .env.local 을 받아 레포 루트에 둔다");
} else {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
  const missing = REQUIRED.filter((key) => !env[key]);
  push(
    missing.length === 0,
    ".env.local (필수)",
    missing.length
      ? `비어 있음: ${missing.join(", ")}`
      : `${REQUIRED.length}개 모두 설정됨`,
    "팀에서 받은 값으로 채운다",
  );
  const missingOptional = OPTIONAL.filter((key) => !env[key]);
  push(
    true,
    ".env.local (OAuth)",
    missingOptional.length
      ? `비어 있음: ${missingOptional.join(", ")} — 해당 로그인 버튼이 숨겨진다`
      : "Google·GitHub 모두 설정됨",
  );
}

// ── Postgres ────────────────────────────────────────────────────────────
async function checkPostgres(): Promise<void> {
  const reachable = await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: 5432 });
    const done = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1500);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
  push(
    reachable,
    "Postgres (localhost:5432)",
    reachable ? "연결됨" : "연결 안 됨",
    "pnpm docker:db",
  );
}

async function main() {
  await checkPostgres();

  const width = Math.max(...results.map((r) => r.label.length));
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed += 1;
    console.log(`${r.ok ? "✓" : "✗"} ${r.label.padEnd(width)}  ${r.detail}`);
    if (!r.ok && r.fix) console.log(`  ${" ".repeat(width)}→ ${r.fix}`);
  }

  console.log(
    failed === 0
      ? "\n준비 완료. pnpm db:push 후 pnpm dev."
      : `\n${failed}개 항목을 해결해야 합니다. 자세한 절차는 SETUP.md 참고.`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main();
