/**
 * 원장 — 모든 모델 왕복의 토큰·지연·실패를 한 곳에 모은다.
 *
 * 이게 없던 동안 이 저장소는 **어느 단계가 비싼지 몰랐다.** `usage`·`onFinish`·
 * `experimental_telemetry` 참조가 0건이었고, 그래서 「무엇을 먼저 고칠까」에
 * 대한 모든 답이 추정이었다. 추정으로 고른 최적화 대상은 대개 틀린다.
 *
 * 링버퍼다. 영속화하지 않는다 — 데모 한 번을 프로파일하는 것이 목적이고,
 * 그 이상이 필요해지는 시점에는 이 파일이 아니라 OTel 이 답이다.
 */
export type LedgerEntry = {
  /** 어느 작업의 호출인가. `withTask` 가 심어 준다 */
  task: string;
  /** 이 호출이 속한 실행 */
  runId: string | null;
  ms: number;
  status: number;
  model: string | null;
  input: number | null;
  output: number | null;
  /** 프로바이더가 접두 캐시를 태웠는가. 없으면 null — 「0」과 다르다 */
  cached: number | null;
  at: number;
};

const CAP = 512;
const entries: LedgerEntry[] = [];

export function record(entry: LedgerEntry): void {
  entries.push(entry);
  if (entries.length > CAP) entries.splice(0, entries.length - CAP);
}

export type UsageSummary = {
  calls: number;
  input: number;
  output: number;
  cached: number;
  ms: number;
  failures: number;
  /** 작업별 분해. 무엇이 비싼지는 이 표가 답한다 */
  byTask: Array<{
    task: string;
    calls: number;
    input: number;
    output: number;
    ms: number;
    failures: number;
  }>;
};

export function summary(windowMs?: number, runId?: string): UsageSummary {
  const since = windowMs ? Date.now() - windowMs : 0;
  const rows = entries.filter(
    (e) => e.at >= since && (runId === undefined || e.runId === runId),
  );

  const byTask = new Map<string, UsageSummary["byTask"][number]>();
  let input = 0;
  let output = 0;
  let cached = 0;
  let ms = 0;
  let failures = 0;

  for (const e of rows) {
    input += e.input ?? 0;
    output += e.output ?? 0;
    cached += e.cached ?? 0;
    ms += e.ms;
    const failed = e.status >= 400 || e.status === 0;
    if (failed) failures += 1;

    const row = byTask.get(e.task) ?? {
      task: e.task,
      calls: 0,
      input: 0,
      output: 0,
      ms: 0,
      failures: 0,
    };
    row.calls += 1;
    row.input += e.input ?? 0;
    row.output += e.output ?? 0;
    row.ms += e.ms;
    if (failed) row.failures += 1;
    byTask.set(e.task, row);
  }

  return {
    calls: rows.length,
    input,
    output,
    cached,
    ms,
    failures,
    byTask: [...byTask.values()].sort(
      (a, b) => b.input + b.output - (a.input + a.output),
    ),
  };
}

/** 개발 중에 런 하나를 눈으로 본다. 프로덕션에서는 안 부른다 */
export function table(runId?: string): void {
  if (process.env.NODE_ENV === "production") return;
  const s = summary(undefined, runId);
  if (s.calls === 0) return;
  console.log(
    `[ledger] 호출 ${s.calls} · 입력 ${s.input.toLocaleString()} · 출력 ${s.output.toLocaleString()}` +
      (s.cached ? ` · 캐시 ${s.cached.toLocaleString()}` : "") +
      ` · ${(s.ms / 1000).toFixed(1)}초` +
      (s.failures ? ` · 실패 ${s.failures}` : ""),
  );
  console.table(s.byTask);
}
