import { runBrowserAgent, type TraceEntry } from "./agent";
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
export type AgentId = "eligibility" | "documents" | "outline" | "browser";

export const AGENT_LABEL: Record<AgentId, string> = {
  eligibility: "자격 판정",
  documents: "서류 준비 계획",
  outline: "신청서 설계",
  browser: "신청 폼 작성",
};

export type RunEvent =
  | { type: "start"; agents: AgentId[] }
  | { type: "agent:start"; agent: AgentId }
  | { type: "agent:step"; agent: AgentId; tool: string; detail: string; url?: string }
  | { type: "agent:done"; agent: AgentId; ms: number }
  | { type: "agent:error"; agent: AgentId; error: string }
  | { type: "result"; result: PipelineResult }
  | { type: "end"; ms: number };

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

/** 공고에서 신청 URL 을 찾는다. howToApply 안에 섞여 있는 경우가 대부분이다. */
export function findApplyUrl(notice: Notice): string | null {
  const haystack = [notice.howToApply, notice.target].filter(Boolean).join(" ");
  const match = haystack.match(/https?:\/\/[^\s)"']+/);
  if (match) return match[0];
  const bare = haystack.match(
    /\b(?:www\.)?[a-z0-9-]+\.(?:go\.kr|or\.kr|co\.kr|kr|com)\b/i,
  );
  return bare ? `https://${bare[0].replace(/^https?:\/\//, "")}` : null;
}

export async function runPipeline(
  notice: Notice,
  profile: Profile,
  emit: Emit,
  options: { applyUrl?: string | null } = {},
): Promise<PipelineResult> {
  const started = Date.now();
  const applyUrl = options.applyUrl ?? findApplyUrl(notice);
  const agents: AgentId[] = ["eligibility", "documents", "outline"];
  if (applyUrl) agents.push("browser");
  emit({ type: "start", agents });

  // 1단계 — 서로 독립이라 병렬로 돌린다.
  const [eligibility, documents] = await Promise.all([
    runAgent("eligibility", emit, () => judgeEligibility(notice, profile)),
    runAgent("documents", emit, () => planDocuments(notice)),
  ]);

  const skipOutline = eligibility.value?.overall === "ineligible";

  // 2단계 — 설계와 폼 작성은 서로를 기다릴 이유가 없다. 직렬로 두면 두 배로 걸린다.
  // 브라우저는 20~50초가 걸리므로 반드시 다른 작업과 겹쳐 돌린다.
  const [outline, browser] = await Promise.all([
    skipOutline
      ? Promise.resolve({ value: null, error: "자격 미달로 건너뜀" })
      : runAgent("outline", emit, () => draftOutline(notice, profile)),
    applyUrl && !skipOutline
      ? runAgent("browser", emit, () =>
          runBrowserAgent({
            sessionId: `pipeline-${started}`,
            startUrl: applyUrl,
            goal: `${notice.title} 신청 폼을 채워라. 최종 제출 버튼은 누르지 말고 직전에서 멈춘다.`,
            facts: profile,
            maxSteps: 24,
            onStep: (entry) =>
              emit({
                type: "agent:step",
                agent: "browser",
                tool: entry.tool,
                detail: JSON.stringify(entry.input).slice(0, 120),
                url: entry.url,
              }),
          }),
        )
      : Promise.resolve({
          value: null,
          error: applyUrl ? "자격 미달로 건너뜀" : null,
        }),
  ]);

  const errors: Partial<Record<AgentId, string>> = {};
  if (eligibility.error) errors.eligibility = eligibility.error;
  if (documents.error) errors.documents = documents.error;
  if (outline.error) errors.outline = outline.error;
  if (browser.error) errors.browser = browser.error;

  const result: PipelineResult = {
    eligibility: eligibility.value,
    documents: documents.value,
    outline: outline.value,
    browser: browser.value,
    errors,
  };

  emit({ type: "result", result });
  emit({ type: "end", ms: Date.now() - started });
  return result;
}
