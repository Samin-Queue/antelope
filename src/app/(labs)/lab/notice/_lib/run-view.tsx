"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, CircleDashed, HelpCircle, Loader2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Evidence } from "./evidence";
import { Cite, EvidencePanel } from "./evidence-view";
import type { Notice } from "./schema";
import { AGENT_LABEL, type AgentId, type PipelineResult, type RunEvent } from "./types";

type AgentState = {
  status: "idle" | "running" | "done" | "error";
  ms?: number;
  error?: string;
  /** 브라우저 에이전트의 최근 조작. 무엇을 클릭하고 있는지 보여야 한다 */
  steps?: string[];
};

const IDLE: Record<AgentId, AgentState> = {
  eligibility: { status: "idle" },
  documents: { status: "idle" },
  outline: { status: "idle" },
  browser: { status: "idle" },
};

const TOOL_LABEL: Record<string, string> = {
  goto: "이동",
  snapshot: "화면 읽기",
  click: "클릭",
  fill: "입력",
  select: "선택",
  check: "체크",
};

const ORIGIN_LABEL = {
  hold: "보유",
  issue: "발급",
  write: "작성",
} as const;

const OVERALL = {
  eligible: { label: "신청 가능", tone: "text-brand" },
  unclear: { label: "확인 필요", tone: "text-amber-500" },
  ineligible: { label: "신청 불가", tone: "text-destructive" },
} as const;

export function RunView({
  notice,
  profile,
  goalId,
  evidence = [],
  cited = [],
}: {
  notice: Notice;
  profile: Record<string, string>;
  /** 로그인·DB 가 없으면 null. 그때는 목표를 남기지 않고 그냥 돈다 */
  goalId?: string | null;
  /** 원문 좌표. Studio 를 탄 파일 입력에만 있다 */
  evidence?: Evidence[];
  cited?: Evidence[];
}) {
  const router = useRouter();
  const [states, setStates] = useState<Record<AgentId, AgentState>>(IDLE);
  const [agents, setAgents] = useState<AgentId[]>([
    "eligibility",
    "documents",
    "outline",
  ]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [frame, setFrame] = useState<{ image: string; url: string } | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  /**
   * 파이프라인 결과를 목표에 남긴다.
   *
   * 자격 미달은 그 자리에서 끝난 목표다 — 「지난 목표」에서 왜 접었는지 보이도록
   * outcome 까지 박는다. 나머지는 아직 작업 중이다.
   */
  function saveGoal(value: PipelineResult) {
    if (!goalId) return;
    const ineligible = value.eligibility?.overall === "ineligible";
    void fetch("/app/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: goalId,
        stage: ineligible ? "closed" : "working",
        outcome: ineligible ? "ineligible" : null,
        result: value,
      }),
    })
      // 서버에서 그리는 「지난 목표」 탭이 새 값을 읽도록 한 번 새로 고친다.
      .then(() => router.refresh())
      .catch(() => {});
  }

  async function run() {
    if (running) return;
    setRunning(true);
    setResult(null);
    setTotalMs(null);
    setStates(IDLE);
    setFrame(null);

    const response = await fetch("/lab/notice/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notice, profile }),
    });

    if (!response.body) {
      setRunning(false);
      return;
    }

    // SSE 를 직접 읽는다. EventSource 는 POST 를 못 보낸다.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const line = chunk.trim();
        if (!line.startsWith("data: ")) continue;
        const event = JSON.parse(line.slice(6)) as RunEvent;

        if (event.type === "start") {
          setAgents(event.agents);
        } else if (event.type === "frame") {
          setFrame({ image: event.image, url: event.url });
        } else if (event.type === "agent:step") {
          setStates((prev) => ({
            ...prev,
            [event.agent]: {
              ...prev[event.agent],
              status: "running",
              steps: [
                ...(prev[event.agent].steps ?? []).slice(-5),
                `${TOOL_LABEL[event.tool] ?? event.tool} ${event.detail}`,
              ],
            },
          }));
        } else if (event.type === "agent:start") {
          setStates((prev) => ({ ...prev, [event.agent]: { status: "running" } }));
        } else if (event.type === "agent:done") {
          setStates((prev) => ({
            ...prev,
            [event.agent]: { status: "done", ms: event.ms },
          }));
        } else if (event.type === "agent:error") {
          setStates((prev) => ({
            ...prev,
            [event.agent]: { status: "error", error: event.error },
          }));
        } else if (event.type === "result") {
          setResult(event.result);
          saveGoal(event.result);
        } else if (event.type === "end") {
          setTotalMs(event.ms);
        }
      }
    }
    setRunning(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={running}>
          {running && <Loader2 className="animate-spin" />}
          {running ? "에이전트 실행 중" : "신청 준비 시작"}
        </Button>
        {totalMs !== null && (
          <span className="font-mono text-xs text-muted-foreground">
            전체 {(totalMs / 1000).toFixed(1)}초
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <LiveScreen frame={frame} running={running} />
        <ul className="space-y-2.5">
          {agents.map((id) => (
            <AgentCard key={id} id={id} state={states[id]} />
          ))}
        </ul>
      </div>

      {result && (
        <ResultView result={result} notice={notice} evidence={evidence} cited={cited} />
      )}
    </div>
  );
}

/**
 * 에이전트가 조작 중인 실제 화면.
 *
 * 데모의 제약은 실무와 반대다 — 3분 동안 화면이 죽으면 안 된다. 진행 막대보다
 * 진짜 폼에 글자가 채워지는 장면이 시간을 채우면서 동시에 읽힌다.
 */
function LiveScreen({
  frame,
  running,
}: {
  frame: { image: string; url: string } | null;
  running: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {frame?.url ?? "about:blank"}
        </span>
        {running && frame && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-brand">
            <span className="size-1.5 animate-pulse rounded-full bg-brand" />
            LIVE
          </span>
        )}
      </div>
      <div className="relative aspect-[16/10] bg-muted/30">
        {frame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frame.image}
            alt="에이전트가 조작 중인 화면"
            className="size-full object-cover object-top"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
            {running ? "브라우저 준비 중" : "신청 URL 이 있으면 여기에 실제 화면이 뜬다"}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ id, state }: { id: AgentId; state: AgentState }) {
  return (
    <li
      className={cn(
        "rounded-2xl border bg-card p-4 transition-colors",
        state.status === "running" && "border-brand",
        state.status === "done" && "border-brand/40",
        state.status === "error" && "border-destructive/50",
        state.status === "idle" && "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        {state.status === "running" ? (
          <Loader2 className="size-4 animate-spin text-brand" />
        ) : state.status === "done" ? (
          <CheckCircle2 className="size-4 text-brand" />
        ) : state.status === "error" ? (
          <XCircle className="size-4 text-destructive" />
        ) : (
          <CircleDashed className="size-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">{AGENT_LABEL[id]}</span>
        {state.ms !== undefined && (
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {(state.ms / 1000).toFixed(1)}초
          </span>
        )}
      </div>
      {state.error && (
        <p className="mt-2 font-mono text-xs break-words text-destructive">
          {state.error}
        </p>
      )}
    </li>
  );
}

function ResultView({
  result,
  notice,
  evidence,
  cited,
}: {
  result: PipelineResult;
  notice: Notice;
  evidence: Evidence[];
  cited: Evidence[];
}) {
  const { eligibility, documents, outline, browser } = result;

  /**
   * 판정에 걸린 요건의 원문 문장.
   *
   * 판정문은 모델이 쓴 말이라 원문과 글자가 다르다. 추출 단계에서 요건마다
   * 받아 둔 `source` 를 통해 원문으로 되돌린다 — 그게 실제로 문서에 있던 문장이다.
   */
  const sourceOf = (requirement: string): string =>
    notice.requirements.find((item) => item.text === requirement)?.source ?? requirement;

  return (
    <div className="space-y-6">
      {eligibility && (
        <div className="grid gap-4 lg:grid-cols-[1fr_19rem] lg:items-start">
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">자격 판정</h3>
              <span
                className={cn("text-sm font-medium", OVERALL[eligibility.overall].tone)}
              >
                {OVERALL[eligibility.overall].label}
              </span>
            </div>
            <ul className="mt-4 space-y-2">
              {eligibility.verdicts.map((item) => (
                <li key={item.requirement} className="rounded-lg bg-muted/40 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    {item.status === "meets" ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
                    ) : item.status === "fails" ? (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <HelpCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    )}
                    <div className="min-w-0">
                      <Cite
                        label="자격 요건"
                        needle={sourceOf(item.requirement)}
                        className="text-sm"
                      >
                        {item.requirement}
                      </Cite>
                      {item.reason && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.reason}
                        </p>
                      )}
                      {item.needsFromUser && (
                        <p className="mt-1 text-xs text-amber-500">
                          확인 필요 — {item.needsFromUser}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          {evidence.length > 0 && (
            <div className="lg:sticky lg:top-6">
              <EvidencePanel evidence={evidence} cited={cited} />
            </div>
          )}
        </div>
      )}

      {documents && documents.items.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium">서류 준비</h3>
          <ul className="mt-4 space-y-2">
            {documents.items.map((item) => (
              <li key={item.name} className="rounded-lg bg-muted/40 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.origin === "write" ? "default" : "secondary"}>
                    {ORIGIN_LABEL[item.origin]}
                  </Badge>
                  <span className="text-sm">{item.name}</span>
                  {item.canAutomate && <Badge variant="outline">자동 작성 가능</Badge>}
                  {item.estimatedMinutes !== null && (
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      ~{item.estimatedMinutes}분
                    </span>
                  )}
                </div>
                {item.how && (
                  <p className="mt-1 text-xs text-muted-foreground">{item.how}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {browser && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium">신청 폼 작성</h3>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {browser.steps}스텝 · {browser.finalUrl}
          </p>
          <ol className="mt-4 space-y-1">
            {browser.trace.map((entry) => (
              <li key={entry.step} className="flex gap-2 text-xs">
                <span className="w-5 shrink-0 text-right font-mono text-muted-foreground">
                  {entry.step}
                </span>
                <span className="w-12 shrink-0 text-brand">
                  {TOOL_LABEL[entry.tool] ?? entry.tool}
                </span>
                <span className="min-w-0 truncate font-mono text-muted-foreground">
                  {JSON.stringify(entry.input)}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm whitespace-pre-wrap">{browser.summary}</p>
        </section>
      )}

      {outline && outline.sections.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium">신청서 설계</h3>
          <ul className="mt-4 space-y-3">
            {outline.sections.map((section) => (
              <li key={section.heading} className="rounded-lg bg-muted/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{section.heading}</span>
                  {section.points !== null && (
                    <span className="ml-auto font-mono text-xs text-brand">
                      {section.points}점
                    </span>
                  )}
                </div>
                {section.whatTheyWant && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {section.whatTheyWant}
                  </p>
                )}
                <ul className="mt-2 space-y-1">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="text-xs text-muted-foreground">
                      · {bullet}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
