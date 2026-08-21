"use client";

import { useState } from "react";
import { CheckCircle2, CircleDashed, HelpCircle, Loader2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  AGENT_LABEL,
  type AgentId,
  type PipelineResult,
  type RunEvent,
} from "./orchestrator";
import type { Notice } from "./schema";

type AgentState = {
  status: "idle" | "running" | "done" | "error";
  ms?: number;
  error?: string;
};

const AGENTS: AgentId[] = ["eligibility", "documents", "outline"];

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
}: {
  notice: Notice;
  profile: Record<string, string>;
}) {
  const [states, setStates] = useState<Record<AgentId, AgentState>>({
    eligibility: { status: "idle" },
    documents: { status: "idle" },
    outline: { status: "idle" },
  });
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    if (running) return;
    setRunning(true);
    setResult(null);
    setTotalMs(null);
    setStates({
      eligibility: { status: "idle" },
      documents: { status: "idle" },
      outline: { status: "idle" },
    });

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

        if (event.type === "agent:start") {
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

      <ul className="grid gap-3 sm:grid-cols-3">
        {AGENTS.map((id) => (
          <AgentCard key={id} id={id} state={states[id]} />
        ))}
      </ul>

      {result && <ResultView result={result} />}
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

function ResultView({ result }: { result: PipelineResult }) {
  const { eligibility, documents, outline } = result;

  return (
    <div className="space-y-6">
      {eligibility && (
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
                    <p className="text-sm">{item.requirement}</p>
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
