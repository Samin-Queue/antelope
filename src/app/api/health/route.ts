import { readFile } from "node:fs/promises";

import { laneGauges } from "@/lib/ai/lanes";
import { summary } from "@/lib/ai/ledger";
import { hasDb } from "@/lib/db";
import { llmInfo } from "@/lib/llm";
import { searchProviders } from "@/lib/search";

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
    // `ok` 는 **프로세스 생존**만 뜻한다. Railway healthcheck 가 이 응답을
    // 보므로 상류 순단으로 롤백이 걸리면 안 된다 — 상류 상태는 아래에 따로 쓴다.
    ok: true,
    commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
    db: hasDb() ? "configured" : "missing",
    llm: llmInfo(),
    /**
     * 공고를 찾는 레인. 비면 「제목만 준 입력」이 되살아나지 못한다 —
     * 그때 화면에는 「원문을 못 찾았다」만 뜨므로 여기서 구분한다.
     */
    search: searchProviders(),
    /**
     * 최근 10분의 모델 왕복.
     *
     * 이게 없던 동안 「어느 단계가 비싼가」에 대한 모든 답이 추정이었다.
     */
    ai: summary(600_000),
    /**
     * 자원 게이지.
     *
     * 단일 실행 프로파일러만 있으면 이 시스템이 실제로 죽는 방식(동시 2건에서
     * Chromium OOM, 레인 대기 적체)은 안 잡힌다.
     */
    lanes: laneGauges(),
    memory: await memory(),
    uptimeSec: Math.round(process.uptime()),
  });
}
