/**
 * 클라이언트와 서버가 공유하는 타입·상수.
 *
 * ⚠ 이 파일은 런타임 의존성을 갖지 않는다. orchestrator 를 클라이언트에서
 * import 하면 playwright 가 브라우저 번들로 끌려가 `async_hooks` 를 못 찾고
 * 빌드가 통째로 깨진다. UI 는 반드시 여기서만 가져간다.
 */
import type { DocumentPlan, Eligibility, Outline } from "./agents";

export type AgentId = "eligibility" | "documents" | "outline" | "browser";

export const AGENT_LABEL: Record<AgentId, string> = {
  eligibility: "자격 판정",
  documents: "서류 준비 계획",
  outline: "신청서 설계",
  browser: "신청 폼 작성",
};

export type TraceEntry = {
  step: number;
  tool: string;
  input: unknown;
  output: string;
  url?: string;
};

export type BrowserRun = {
  summary: string;
  steps: number;
  finalUrl: string;
  trace: TraceEntry[];
};

export type PipelineResult = {
  eligibility: Eligibility | null;
  documents: DocumentPlan | null;
  outline: Outline | null;
  browser: BrowserRun | null;
  errors: Partial<Record<AgentId, string>>;
};

export type RunEvent =
  | { type: "start"; agents: AgentId[] }
  | { type: "agent:start"; agent: AgentId }
  | { type: "agent:step"; agent: AgentId; tool: string; detail: string; url?: string }
  | { type: "agent:done"; agent: AgentId; ms: number }
  | { type: "agent:error"; agent: AgentId; error: string }
  | { type: "result"; result: PipelineResult }
  | { type: "end"; ms: number };
