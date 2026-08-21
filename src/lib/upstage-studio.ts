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
