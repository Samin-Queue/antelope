import { notFound } from "next/navigation";
import { CalendarDays, ExternalLink, FileText } from "lucide-react";

import { currentSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/components/app/app-header";
import { Badge } from "@/components/ui/badge";
import {
  PLAN_OWNER_LABEL,
  STAGES,
  STAGE_LABEL as STEP_LABEL,
  type Need,
  type Plan,
  type SessionSnapshot,
} from "@/app/(app)/app/start/_lib/types";
import type { Notice } from "@/app/(labs)/lab/notice/_lib/schema";

import { getGoal, OUTCOME_LABEL, STAGE_LABEL } from "../../_lib/goals";

export const dynamic = "force-dynamic";

/**
 * 준비가 어디까지 갔는가.
 *
 * 탭을 닫아도 준비는 끝까지 간다. 그러면 돌아온 사용자의 첫 질문이 「끝났나」다 —
 * 스냅샷의 `stages` 가 그 답인데 여태 아무도 안 읽고 있었다.
 */
function Progress({ id, stages }: { id: string; stages: SessionSnapshot["stages"] }) {
  const done = STAGES.filter((id) => stages[id] === "done").length;
  const failed = STAGES.filter((id) => stages[id] === "error");
  const running = STAGES.filter((id) => !stages[id]);
  const unfinished = running.length > 0 || failed.length > 0;

  return (
    <section>
      <h2 className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
        준비 {done}/{STAGES.length}
        {running.length > 0 ? (
          <span className="text-xs font-normal text-muted-foreground">
            아직 도는 중 — {STEP_LABEL[running[0]].title}
          </span>
        ) : (
          <span className="text-xs font-normal text-muted-foreground">끝났다</span>
        )}
        {/*
          끝난 단계는 다시 안 돈다. 서버가 스냅샷을 보고 건너뛴다 —
          사용자가 채운 값도 그대로 이어받는다.
        */}
        {unfinished && (
          <a
            href={`/app?resume=${id}`}
            className="ml-auto rounded-md border border-border px-2 py-1 text-xs hover:border-brand hover:text-brand"
          >
            여기서 이어서 준비
          </a>
        )}
      </h2>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STAGES.map((id) => {
          const state = stages[id];
          return (
            <span
              key={id}
              title={STEP_LABEL[id].title}
              className={cn(
                "rounded-sm px-2 py-1 text-[11px]",
                state === "done" && "bg-brand/10 text-brand",
                state === "error" && "bg-destructive/10 text-destructive",
                state === "skip" && "bg-muted text-muted-foreground line-through",
                !state && "bg-muted/50 text-muted-foreground",
              )}
            >
              {STEP_LABEL[id].title}
            </span>
          );
        })}
      </div>
      {failed.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {failed.map((id) => STEP_LABEL[id].title).join(", ")} 단계는 실패했다. 나머지로
          이어서 신청할 수 있다.
        </p>
      )}
    </section>
  );
}

const KIND_LABEL: Record<Need["kind"], string> = {
  text: "글자",
  long: "서술",
  date: "날짜",
  number: "숫자",
  select: "선택",
  checkbox: "예/아니오",
  file: "파일",
};

/**
 * 세션 하나를 다시 펼쳐 본다.
 *
 * 스냅샷이 있으면 그것을 그린다 — 요약·모아 온 파일·마스터 테이블이 세션의
 * 실체다. 스냅샷 이전에 만들어진 세션은 `notice` 만 있으므로 그쪽으로 떨어진다.
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await currentSession();
  if (!session) notFound();

  const goal = await getGoal(session.user.id, id);
  if (!goal) notFound();

  const snapshot = goal.snapshot as SessionSnapshot | null;
  const notice = goal.notice as Notice | null;

  return (
    <>
      <AppHeader trail={["모든 세션", goal.title]} />
      <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-8">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{STAGE_LABEL[goal.stage]}</Badge>
            {goal.outcome && (
              <Badge variant="secondary">{OUTCOME_LABEL[goal.outcome]}</Badge>
            )}
          </div>
          <h1 className="text-lg font-medium">{goal.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {goal.organization && <span>{goal.organization}</span>}
            {goal.deadline && (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {goal.deadline}
              </span>
            )}
            {snapshot?.applyUrl && (
              <a
                href={snapshot.applyUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-brand hover:underline"
              >
                신청 페이지
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </header>

        {snapshot?.stages ? <Progress id={goal.id} stages={snapshot.stages} /> : null}

        {snapshot?.plan?.steps?.length ? <PlanView plan={snapshot.plan} /> : null}

        {snapshot?.needs?.length ? (
          <MasterTable needs={snapshot.needs} />
        ) : (
          <LegacyNotice notice={notice} />
        )}

        {snapshot?.artifacts?.length ? (
          <section>
            <h2 className="text-sm font-medium">
              작성한 서류 {snapshot.artifacts.length}
            </h2>
            <ul className="mt-3 space-y-1.5">
              {snapshot.artifacts.map((item) => (
                <li
                  key={item.needKey}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                >
                  <FileText className="size-3.5 shrink-0 text-brand" />
                  <span className="truncate">{item.filename}</span>
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {(item.bytes / 1024).toFixed(0)}KB
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {snapshot?.files?.length ? (
          <section>
            <h2 className="text-sm font-medium">모아 온 자료 {snapshot.files.length}</h2>
            <ul className="mt-3 space-y-1.5">
              {snapshot.files.map((file) => (
                <li
                  key={`${file.origin}-${file.name}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                >
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                  <Badge variant="outline">{file.origin}</Badge>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {(file.bytes / 1024).toFixed(0)}KB
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {snapshot?.brief ? (
          <section>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">신청 준비 문서</h2>
              <span className="font-mono text-xs text-muted-foreground">analysis</span>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {snapshot.brief}
            </pre>
          </section>
        ) : null}

        {snapshot?.summary?.markdown ? (
          <section>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">요약</h2>
              <span className="font-mono text-xs text-muted-foreground">
                {snapshot.summary.via}
              </span>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {snapshot.summary.markdown}
            </pre>
          </section>
        ) : null}
      </div>
    </>
  );
}

/** 진행 계획 — 언제 · 어디서 · 누가. */
function PlanView({ plan }: { plan: Plan }) {
  return (
    <section>
      <h2 className="text-sm font-medium">진행 계획 {plan.steps.length}단계</h2>
      <ol className="mt-3 space-y-1.5">
        {plan.steps.map((step, index) => (
          <li
            key={step.id}
            className="flex flex-wrap items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5"
          >
            <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{step.title}</p>
              {step.detail && (
                <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
              )}
            </div>
            <Badge variant={step.owner === "user" ? "default" : "outline"}>
              {PLAN_OWNER_LABEL[step.owner]}
            </Badge>
            {step.dueDate && (
              <span className="font-mono text-xs text-muted-foreground">
                {step.dueDate}
              </span>
            )}
          </li>
        ))}
      </ol>
      {plan.markdown && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            계획서 전문
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {plan.markdown}
          </pre>
        </details>
      )}
    </section>
  );
}

/** 마스터 테이블 — 이 세션이 무엇을 알고 무엇을 모르는지. */
function MasterTable({ needs }: { needs: Need[] }) {
  const filled = needs.filter((need) => need.value?.trim()).length;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">마스터 테이블</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {filled}/{needs.length} 채움
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {needs.map((need) => (
          <li key={need.key} className="rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">{need.label}</span>
              {need.required && <span className="text-xs text-brand">필수</span>}
              <Badge variant="outline">{KIND_LABEL[need.kind]}</Badge>
              <span
                className={cn(
                  "ml-auto truncate text-sm",
                  need.value?.trim() ? "" : "text-muted-foreground",
                )}
              >
                {need.value?.trim() || "비어 있음"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {need.from === "memory" && (
                <span className="text-brand">
                  지식베이스{need.memoryLabel ? ` · ${need.memoryLabel}` : ""}
                </span>
              )}
              {need.from === "user" && <span>직접 입력</span>}
              {need.why && <span className="truncate">{need.why}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 스냅샷 이전에 만들어진 세션. 지워질 때까지만 그린다. */
function LegacyNotice({ notice }: { notice: Notice | null }) {
  if (!notice?.requirements?.length && !notice?.documents?.length) {
    return (
      <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        저장된 준비 내용이 없다. 스냅샷을 남기기 전에 만들어진 세션이다.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {notice.requirements?.length ? (
        <section>
          <h2 className="text-sm font-medium">자격 요건 {notice.requirements.length}</h2>
          <ul className="mt-2 space-y-1.5">
            {notice.requirements.map((item) => (
              <li key={item.text} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {notice.documents?.length ? (
        <section>
          <h2 className="text-sm font-medium">제출 서류 {notice.documents.length}</h2>
          <ul className="mt-2 space-y-1.5">
            {notice.documents.map((item) => (
              <li key={item.name} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                {item.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
