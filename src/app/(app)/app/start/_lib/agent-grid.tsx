"use client";

import { useEffect, useRef } from "react";
import { Check, Loader2, Minus, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { STAGE_LABEL, STAGES, type AgentKey } from "./types";

/**
 * 에이전트 격자 — 4×2.
 *
 * 진행 막대 하나로는 「무엇이 지금 돌고 있고 무엇을 하고 있는지」가 안 보인다.
 * CLI 가 모델의 사고를 흘리는 것과 같은 이유로, 카드마다 그 에이전트가 방금
 * 무엇을 했는지를 그대로 흘린다.
 *
 * **켜진 테두리는 실제로 도는 것만이다.** 브라우저가 도중에 데이터·파일·계획을
 * 되부르면 그 칸이 함께 켜진다 — 티키타카가 화면에 그대로 보인다. 보이기 위해
 * 임의로 켜지 않는다.
 */
export type CardState = {
  status: "idle" | "running" | "done" | "error" | "skip";
  detail?: string;
  logs: string[];
  /** 그 에이전트가 낸 것 한 줄 */
  output?: string;
};

export type Cards = Record<AgentKey, CardState>;

export const IDLE_CARD: CardState = { status: "idle", logs: [] };

const ALL: AgentKey[] = [...STAGES, "browser"];

export function emptyCards(): Cards {
  const cards = {} as Cards;
  for (const key of ALL) cards[key] = { ...IDLE_CARD, logs: [] };
  return cards;
}

export function AgentGrid({ cards }: { cards: Cards }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {STAGES.map((key) => (
        <AgentCard key={key} agent={key} state={cards[key]} />
      ))}
    </div>
  );
}

export function AgentCard({
  agent,
  state,
  className,
}: {
  agent: AgentKey;
  state: CardState;
  className?: string;
}) {
  const label = STAGE_LABEL[agent];
  const running = state.status === "running";

  return (
    <section
      className={cn(
        "flex h-44 flex-col overflow-hidden rounded-xl border bg-card transition-colors",
        running ? "border-brand shadow-[0_0_0_1px_var(--brand)]" : "border-border",
        state.status === "error" && "border-destructive/60",
        state.status === "idle" && "opacity-55",
        className,
      )}
    >
      <header className="flex shrink-0 items-center gap-1.5 border-b border-border/60 px-2.5 py-2">
        <StatusMark status={state.status} />
        <span className="truncate text-xs font-medium">{label.title}</span>
        <span className="ml-auto shrink-0 truncate font-mono text-[10px] text-muted-foreground">
          {label.agent}
        </span>
      </header>

      <LogStream logs={state.logs} detail={state.detail} status={state.status} />

      {state.output && (
        <footer className="shrink-0 border-t border-border/60 px-2.5 py-1.5">
          <p className="truncate text-[11px] text-brand">{state.output}</p>
        </footer>
      )}
    </section>
  );
}

function StatusMark({ status }: { status: CardState["status"] }) {
  if (status === "running") return <Loader2 className="size-3 animate-spin text-brand" />;
  if (status === "done") return <Check className="size-3 text-brand" />;
  if (status === "error") return <X className="size-3 text-destructive" />;
  if (status === "skip") return <Minus className="size-3 text-muted-foreground" />;
  return (
    <span className="size-3 rounded-full border border-dashed border-muted-foreground/50" />
  );
}

/**
 * 카드 안쪽만 스크롤한다.
 *
 * 새 줄은 아래로 따라붙되, 사용자가 위로 올려 읽는 중이면 붙지 않는다 —
 * 읽던 자리를 뺏기면 흘러가는 로그는 아무 값어치가 없다.
 */
function LogStream({
  logs,
  detail,
  status,
}: {
  logs: string[];
  detail?: string;
  status: CardState["status"];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || !stick.current) return;
    node.scrollTop = node.scrollHeight;
  }, [logs.length, detail]);

  return (
    <div
      ref={ref}
      onScroll={(event) => {
        const node = event.currentTarget;
        stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
      }}
      className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 py-2"
    >
      {logs.length === 0 && !detail && (
        <p className="text-[11px] text-muted-foreground">
          {status === "idle" ? "대기" : "…"}
        </p>
      )}
      {logs.map((line, index) => (
        <p
          key={`${index}-${line.slice(0, 12)}`}
          className="text-[11px] leading-relaxed break-words text-muted-foreground"
        >
          {line}
        </p>
      ))}
      {detail && (
        <p
          className={cn(
            "text-[11px] leading-relaxed break-words",
            status === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {detail}
        </p>
      )}
    </div>
  );
}
