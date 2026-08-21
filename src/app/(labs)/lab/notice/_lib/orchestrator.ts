import {
  draftOutline,
  judgeEligibility,
  planDocuments,
  type DocumentPlan,
  type Eligibility,
  type Outline,
  type Profile,
} from "./agents";
import type { Notice } from "./schema";

/**
 * 오케스트레이터.
 *
 * 서브에이전트를 단계별로 굴린다. 1단계 셋은 서로를 기다릴 이유가 없어 병렬로,
 * 2단계는 1단계 결과가 있어야 의미가 있어 직렬로 둔다.
 *
 * 진행 상황을 이벤트로 흘려보낸다 — 멀티에이전트는 눈에 보여야 값어치가 있다.
 */
export type AgentId = "eligibility" | "documents" | "outline";

export const AGENT_LABEL: Record<AgentId, string> = {
  eligibility: "자격 판정",
  documents: "서류 준비 계획",
  outline: "신청서 설계",
};

export type RunEvent =
  | { type: "start"; agents: AgentId[] }
  | { type: "agent:start"; agent: AgentId }
  | { type: "agent:done"; agent: AgentId; ms: number }
  | { type: "agent:error"; agent: AgentId; error: string }
  | { type: "result"; result: PipelineResult }
  | { type: "end"; ms: number };

export type PipelineResult = {
  eligibility: Eligibility | null;
  documents: DocumentPlan | null;
  outline: Outline | null;
  errors: Partial<Record<AgentId, string>>;
};

type Emit = (event: RunEvent) => void;

/** 실패한 에이전트 하나가 전체를 죽이지 않게 감싼다. */
async function runAgent<T>(
  id: AgentId,
  emit: Emit,
  task: () => Promise<T>,
): Promise<{ value: T | null; error: string | null }> {
  const started = Date.now();
  emit({ type: "agent:start", agent: id });
  try {
    const value = await task();
    emit({ type: "agent:done", agent: id, ms: Date.now() - started });
    return { value, error: null };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    emit({ type: "agent:error", agent: id, error });
    return { value: null, error };
  }
}

export async function runPipeline(
  notice: Notice,
  profile: Profile,
  emit: Emit,
): Promise<PipelineResult> {
  const started = Date.now();
  emit({ type: "start", agents: ["eligibility", "documents", "outline"] });

  // 1단계 — 서로 독립이라 병렬로 돌린다.
  const [eligibility, documents] = await Promise.all([
    runAgent("eligibility", emit, () => judgeEligibility(notice, profile)),
    runAgent("documents", emit, () => planDocuments(notice)),
  ]);

  // 2단계 — 자격이 명백히 안 되면 신청서를 설계할 이유가 없다.
  const skipOutline = eligibility.value?.overall === "ineligible";
  const outline = skipOutline
    ? { value: null, error: "자격 미달로 건너뜀" }
    : await runAgent("outline", emit, () => draftOutline(notice, profile));

  const errors: Partial<Record<AgentId, string>> = {};
  if (eligibility.error) errors.eligibility = eligibility.error;
  if (documents.error) errors.documents = documents.error;
  if (outline.error) errors.outline = outline.error;

  const result: PipelineResult = {
    eligibility: eligibility.value,
    documents: documents.value,
    outline: outline.value,
    errors,
  };

  emit({ type: "result", result });
  emit({ type: "end", ms: Date.now() - started });
  return result;
}
