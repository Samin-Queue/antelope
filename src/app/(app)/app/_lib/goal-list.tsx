import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { OUTCOME_LABEL, STAGE_LABEL, type Goal, type GoalOutcome } from "./goals";

const STAGE_TONE: Record<Goal["stage"], "default" | "secondary" | "outline"> = {
  reviewing: "secondary",
  working: "default",
  waiting: "secondary",
  closed: "outline",
};

const OUTCOME_TONE: Record<GoalOutcome, string> = {
  won: "text-brand",
  rejected: "text-destructive",
  ineligible: "text-destructive",
  deferred: "text-amber-500",
  abandoned: "text-muted-foreground",
};

export function GoalList({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">아직 시작한 목표가 없다.</p>
        <Link
          href="/app"
          className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:underline"
        >
          목표 시작하기
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {goals.map((goal) => (
        <li
          key={goal.id}
          className="rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-brand/40"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STAGE_TONE[goal.stage]}>{STAGE_LABEL[goal.stage]}</Badge>
            <span className="text-sm font-medium">{goal.title}</span>
            {goal.outcome && (
              <span className={`text-xs font-medium ${OUTCOME_TONE[goal.outcome]}`}>
                {OUTCOME_LABEL[goal.outcome]}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {goal.organization && <span>{goal.organization}</span>}
            {goal.deadline && (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3" />
                {goal.deadline}
              </span>
            )}
            <span className="ml-auto font-mono">
              {new Intl.DateTimeFormat("ko-KR", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(goal.updatedAt)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
