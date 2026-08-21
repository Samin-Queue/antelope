import { required } from "@/lib/env";

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

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${required("UPSTAGE_API_KEY")}` };
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
  const response = await fetch(`${BASE}/agents`, {
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
  const response = await fetch(`${BASE}/agents/${opts.agentId}/configs`, {
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

  const response = await fetch(`${BASE}/files`, {
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

/** 2단계 — 에이전트를 실행하고 job 을 만든다. */
export async function createJob(opts: {
  agentId: string;
  fileId: string;
  /** "last" 면 마지막 단계만, "all" 이면 단계별 전부 */
  include?: "last" | "all";
}): Promise<StudioJob> {
  const response = await fetch(`${BASE}/responses`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.agentId,
      input: [
        {
          role: "user",
          content: [{ type: "input_file", file_id: opts.fileId }],
        },
      ],
      include: [opts.include ?? "all"],
    }),
  });
  if (!response.ok) {
    throw new Error(`[studio] responses ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as StudioJob;
}

/** 3단계 — 완료까지 폴링한다. */
export async function waitForJob(
  jobId: string,
  opts: {
    timeoutMs?: number;
    intervalMs?: number;
    onTick?: (status: JobStatus) => void;
  } = {},
): Promise<StudioJob> {
  const timeoutMs = opts.timeoutMs ?? 180_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await fetch(`${BASE}/responses/${jobId}`, { headers: authHeader() });
    if (!response.ok) {
      throw new Error(
        `[studio] responses/${jobId} ${response.status}: ${await response.text()}`,
      );
    }
    const job = (await response.json()) as StudioJob;
    opts.onTick?.(job.status);

    if (job.status === "completed") return job;
    if (job.status === "failed" || job.status === "cancelled") {
      throw new Error(
        `[studio] job ${job.status}: ${JSON.stringify(job.error ?? {}).slice(0, 300)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`[studio] job ${jobId} 시간 초과 (${timeoutMs}ms)`);
}

/** 업로드 → 실행 → 완료까지 한 번에. */
export async function runAgent(opts: {
  agentId: string;
  file: File | Blob;
  filename?: string;
  include?: "last" | "all";
  onStatus?: (status: JobStatus) => void;
}): Promise<StudioJob> {
  const uploaded = await uploadFile(opts.file, opts.filename);
  const job = await createJob({
    agentId: opts.agentId,
    fileId: uploaded.id,
    include: opts.include,
  });
  return waitForJob(job.id, { onTick: opts.onStatus });
}
