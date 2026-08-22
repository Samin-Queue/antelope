import { meteredFetch } from "@/lib/ai/meter";
import { env, required } from "@/lib/env";

/**
 * Upstage Studio 에이전트 클라이언트 (/v2).
 *
 * 트랙 요건이 "Upstage Studio must power the core document-processing stages" 라
 * 문서 처리의 중심을 여기로 옮긴다. v1 REST 직접 호출과 달리 Studio 에서 구성한
 * 멀티스텝 워크플로(Parse → Classify → Extract → Instruct)를 Agent ID 로 실행한다.
 *
 * 3단계다 — 업로드 → job 생성 → 폴링. 동기 응답이 아니다.
 */
const BASE = "https://api.upstage.ai/v2";

/**
 * Studio 는 별도 키를 쓸 수 있다.
 *
 * ⚠ Agent·Config 는 **키를 소유한 계정에 묶인다.** 여기 쓰는 키로 만들지 않은
 * 에이전트는 `GET /v2/agents` 에서 안 보이거나, 보이더라도 job 을 만들 때
 * `403 No access to file` 로 죽는다 — 오류가 파일 쪽으로 나와 원인을 엉뚱한
 * 데서 찾게 된다. 키를 바꾸면 `pnpm studio:provision` 을 다시 돌린다.
 */
function authHeader(): Record<string, string> {
  const key = env.UPSTAGE_STUDIO_API_KEY || required("UPSTAGE_API_KEY");
  return { Authorization: `Bearer ${key}` };
}

export type StudioFile = { id: string; bytes?: number; filename?: string };

// ── Agent · Config ──────────────────────────────────────────────────────
//
// Config 를 코드로 만들 수 있다. Studio UI 를 거치지 않아도 되고, 워크플로가
// 레포에 남아 리뷰·버전 관리가 된다.
//
// 규칙 (스펙에서 검증됨):
//   - document-parse 가 반드시 첫 스텝이다
//   - 순서는 DP → DC → IE. document-classify 가 IE 뒤에 올 수 없다
//   - instruct 는 DP 뒤 어디든 들어간다
//   - is_first 는 정확히 하나
//   - Config 는 생성 후 불변이다. 고치려면 새로 만든다

export type StepType =
  "document-parse" | "document-classify" | "information-extract" | "instruct";

export type NextStep = {
  step_name: string;
  /** 없으면 무조건 이 경로. classify 결과로 분기할 때만 쓴다 */
  condition?: { field: string; operator: "==" | "!="; value: string };
};

export type Step = {
  name: string;
  type: StepType;
  data: Record<string, unknown>;
  is_first?: boolean;
  next_steps: NextStep[];
};

export type StudioAgent = { id: string; name?: string };
export type StudioConfig = { id: string; external_id?: string };

export async function createAgent(name: string): Promise<StudioAgent> {
  const response = await meteredFetch(`${BASE}/agents`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(`[studio] agents ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as StudioAgent;
}

export async function createConfig(opts: {
  agentId: string;
  name?: string;
  steps: Step[];
  isDefault?: boolean;
}): Promise<StudioConfig> {
  const response = await meteredFetch(`${BASE}/agents/${opts.agentId}/configs`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      name: opts.name,
      is_default: opts.isDefault ?? true,
      steps: opts.steps,
    }),
  });
  if (!response.ok) {
    throw new Error(`[studio] configs ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as StudioConfig;
}

/** 1단계 — 파일을 올리고 file_id 를 받는다. */
export async function uploadFile(
  file: File | Blob,
  filename?: string,
): Promise<StudioFile> {
  const form = new FormData();
  form.append("file", file, filename ?? (file as File).name ?? "document");
  form.append("purpose", "user_data");

  const response = await meteredFetch(`${BASE}/files`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  });
  if (!response.ok) {
    throw new Error(`[studio] files ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as StudioFile;
}

export type JobStatus = "queued" | "in_progress" | "completed" | "failed" | "cancelled";

export type StudioJob = {
  id: string;
  status: JobStatus;
  /** 완료 시 단계별 출력 */
  output?: unknown;
  error?: unknown;
};

/**
 * 2단계 — 에이전트를 실행하고 job 을 만든다.
 *
 * 파일을 **여러 개** 받는다. 이 함수가 하나만 받던 동안 `start/analyze` 와
 * `lab/analysis/ingest` 가 같은 요청을 raw fetch 로 복제해 두 벌 들고 있었고,
 * 그 안에 키 해석 규칙(Studio 전용 키 → v1 키)이 같이 복제돼 있었다 —
 * AGENTS.md 가 「이걸로 프로덕션이 한 번 죽었다」고 적은 바로 그 값이다.
 */
export async function createJob(opts: {
  agentId: string;
  fileId?: string;
  fileIds?: string[];
  signal?: AbortSignal;
}): Promise<StudioJob> {
  const ids = opts.fileIds ?? (opts.fileId ? [opts.fileId] : []);
  if (ids.length === 0) throw new Error("[studio] 넘길 파일이 없다");

  const response = await meteredFetch(`${BASE}/responses`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.agentId,
      input: [
        {
          role: "user",
          content: ids.map((id) => ({ type: "input_file", file_id: id })),
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`[studio] responses ${response.status}: ${await response.text()}`);
  }
  const job = (await response.json()) as StudioJob;
  if (!job.id) throw new Error("[studio] job id 를 돌려주지 않았다");
  return job;
}

/** 3단계 — 완료까지 폴링한다. */
export async function waitForJob(
  jobId: string,
  opts: {
    timeoutMs?: number;
    intervalMs?: number;
    include?: "last" | "all";
    onTick?: (status: JobStatus) => void;
    signal?: AbortSignal;
  } = {},
): Promise<StudioJob> {
  const timeoutMs = opts.timeoutMs ?? 180_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;

  // ⚠ include 는 GET 쿼리 파라미터다. createJob 본문에 넣으면 무시되고
  // 마지막 스텝만 돌아온다.
  const include = opts.include ?? "all";

  /**
   * 폴링 중에는 **상태만** 받는다.
   *
   * `include=all` 은 parse 요소와 좌표까지 전부 실어 온다. 완료를 기다리는
   * 동안 그걸 90번 왕복시킬 이유가 없다 — 마지막 한 번만 전체로 다시 받는다.
   */
  const poll = include === "all" ? "last" : include;

  while (Date.now() < deadline) {
    opts.signal?.throwIfAborted();
    const response = await meteredFetch(`${BASE}/responses/${jobId}?include=${poll}`, {
      headers: authHeader(),
      // 폴 하나가 매달려 전체 상한을 잡아먹지 않게. 다음 틱에 다시 묻는다.
      signal: AbortSignal.any(
        [opts.signal, AbortSignal.timeout(15_000)].filter(Boolean) as AbortSignal[],
      ),
    });
    if (!response.ok) {
      throw new Error(
        `[studio] responses/${jobId} ${response.status}: ${await response.text()}`,
      );
    }
    const job = (await response.json()) as StudioJob;
    opts.onTick?.(job.status);

    if (job.status === "completed") {
      if (poll === include) return job;
      // 완료된 뒤 한 번만 전체 스텝을 받는다.
      const full = await meteredFetch(`${BASE}/responses/${jobId}?include=${include}`, {
        headers: authHeader(),
        signal: opts.signal,
      });
      return full.ok ? ((await full.json()) as StudioJob) : job;
    }
    if (job.status === "failed" || job.status === "cancelled") {
      throw new Error(
        `[studio] job ${job.status}: ${JSON.stringify(job.error ?? {}).slice(0, 300)}`,
      );
    }
    await sleep(intervalMs, opts.signal);
  }
  throw new Error(`[studio] job ${jobId} 시간 초과 (${timeoutMs}ms)`);
}

/** 취소 신호를 존중하는 대기. `setTimeout` 만 쓰면 중단해도 끝까지 잔다 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** 업로드 → 실행 → 완료까지 한 번에. */
export async function runAgent(opts: {
  agentId: string;
  /** 하나만 올릴 때 */
  file?: File | Blob;
  filename?: string;
  /** 여럿을 한 job 에 넣을 때. 이미 올린 것은 `fileIds` 로 재사용한다 */
  files?: Array<{ blob: File | Blob; name?: string }>;
  fileIds?: string[];
  include?: "last" | "all";
  timeoutMs?: number;
  onStatus?: (status: JobStatus) => void;
  signal?: AbortSignal;
}): Promise<StudioJob> {
  const uploaded = opts.files?.length
    ? await Promise.all(opts.files.map((f) => uploadFile(f.blob, f.name)))
    : opts.file
      ? [await uploadFile(opts.file, opts.filename)]
      : [];
  const fileIds = [...(opts.fileIds ?? []), ...uploaded.map((f) => f.id)];

  const job = await createJob({ agentId: opts.agentId, fileIds, signal: opts.signal });
  return waitForJob(job.id, {
    include: opts.include,
    timeoutMs: opts.timeoutMs,
    onTick: opts.onStatus,
    signal: opts.signal,
  });
}

/**
 * 스텝별 출력.
 *
 * `output[].model` 이 Config 에서 지정한 스텝 이름이고, 실제 값은
 * `content[0].text` 에 **문자열로** 들어온다. JSON 을 낸 스텝도 문자열이라
 * 한 번 파싱해야 한다.
 */
export type StepOutput = {
  step: string;
  text: string;
  /** JSON 스텝이면 파싱된 값. 아니면 null */
  json: unknown;
  /** 인용 근거 좌표 등 */
  citations: unknown;
};

export function stepOutputs(job: StudioJob): StepOutput[] {
  const items = (job.output ?? []) as Array<Record<string, unknown>>;
  return items.map((item) => {
    const content = (item.content as Array<Record<string, unknown>> | undefined)?.[0];
    const step = String(item.model ?? "");
    const raw = (content?.text as string) ?? "";
    let json: unknown = null;
    try {
      json = JSON.parse(raw);
    } catch {
      // JSON 을 낸다고 선언한 스텝이 아닌 경우가 정상이라 던지지 않는다. 다만
      // **JSON 처럼 생겼는데 깨진 것**은 말한다 — 조용히 null 로 떨어지면
      // 「필드 목록을 만들지 못했습니다」만 남고 원인을 못 찾는다.
      if (/^\s*[[{]/.test(raw)) {
        console.warn(`[studio] ${step}: JSON 파싱 실패 — ${raw.slice(0, 200)}`);
      }
      json = null;
    }
    let citations: unknown = null;
    try {
      const extra = content?.additional_values;
      citations =
        typeof extra === "string"
          ? (JSON.parse(extra) as { citations?: unknown }).citations
          : null;
    } catch (error) {
      console.warn(
        `[studio] ${step}: citations 파싱 실패 — ${String(error).slice(0, 120)}`,
      );
      citations = null;
    }
    return { step, text: raw, json, citations };
  });
}

/** 정규화 좌표(0..1) 사각형의 꼭짓점 네 개. 페이지 크기와 무관하다. */
export type Quad = Array<{ x: number; y: number }>;

/**
 * parse 스텝이 `coordinates: true` 로 내려주는 문서 요소.
 * 근거 하이라이트는 이 좌표를 그대로 그린다 — 우리가 추정하지 않는다.
 */
export type ParsedElement = {
  id: number;
  page: number;
  category: string;
  content: { html?: string; markdown?: string; text?: string };
  coordinates: Quad;
};

/**
 * instruct 응답의 인용. 본문에 섞여 오는 `【†1】` 이 여기의 index 를 가리키고,
 * node_index 는 parse 요소의 id 다.
 */
export type Citation = {
  index: number;
  page: number;
  node_index: number;
  coordinates: Quad;
};

/** parse 스텝 출력에서 요소 목록을 꺼낸다. 좌표가 없으면 빈 배열. */
export function parsedElements(parse: StepOutput | null): ParsedElement[] {
  const json = parse?.json as { elements?: ParsedElement[] } | null;
  return json?.elements?.filter((item) => item.coordinates?.length === 4) ?? [];
}

/** 이름이 접두사로 시작하는 첫 스텝. extract-general·extract-job 등을 한 번에 잡는다. */
export function findStep(outputs: StepOutput[], prefix: string): StepOutput | null {
  return outputs.find((item) => item.step.startsWith(prefix)) ?? null;
}
