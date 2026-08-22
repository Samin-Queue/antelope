import { readFile } from "node:fs/promises";

import { hasDb } from "@/lib/db";
import { llmInfo } from "@/lib/llm";

export const dynamic = "force-dynamic";

/**
 * 컨테이너에 실제로 허용된 메모리와 지금 쓰는 양.
 *
 * 브라우저 에이전트가 돌면 Chromium 이 수백 MB 를 더 쓴다. 한도를 넘으면
 * 커널이 **Node 프로세스를 죽이므로** 증상이 「스트림이 조용히 끊김」으로만
 * 나타난다 — 로그도 오류도 남지 않아 밖에서는 원인을 알 수 없다.
 * 여기 숫자가 있으면 추측하지 않아도 된다.
 *
 * cgroup v2(`memory.max`) 를 먼저 보고, 없으면 v1 경로를 본다.
 */
async function memory() {
  const read = async (path: string) => {
    try {
      return (await readFile(path, "utf8")).trim();
    } catch {
      return null;
    }
  };

  const raw =
    (await read("/sys/fs/cgroup/memory.max")) ??
    (await read("/sys/fs/cgroup/memory/memory.limit_in_bytes"));
  const usedRaw =
    (await read("/sys/fs/cgroup/memory.current")) ??
    (await read("/sys/fs/cgroup/memory/memory.usage_in_bytes"));

  const mb = (value: string | null) => {
    if (!value || value === "max") return null;
    const n = Number(value);
    // v1 은 한도가 없으면 터무니없이 큰 수를 넣는다.
    return Number.isFinite(n) && n < 2 ** 53 && n < 1e15
      ? Math.round(n / 1024 / 1024)
      : null;
  };

  const limitMb = mb(raw);
  const usedMb = mb(usedRaw);
  return {
    limitMb,
    usedMb,
    /** Node 힙+외부 버퍼. 남은 여유가 Chromium 몫이다 */
    rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    freeMb: limitMb !== null && usedMb !== null ? limitMb - usedMb : null,
  };
}

export async function GET() {
  return Response.json({
    ok: true,
    commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
    db: hasDb() ? "configured" : "missing",
    llm: llmInfo(),
    memory: await memory(),
    uptimeSec: Math.round(process.uptime()),
  });
}
