import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { AppHeader } from "@/components/app/app-header";
import { Badge } from "@/components/ui/badge";
import type { Notice } from "@/app/(labs)/lab/notice/_lib/schema";

import { getGoal, OUTCOME_LABEL, STAGE_LABEL } from "../../_lib/goals";

export const dynamic = "force-dynamic";

/** 세션 하나를 다시 펼쳐 본다. 저장해 둔 공고 객체를 그대로 그린다. */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;
  if (!session) notFound();

  const goal = await getGoal(session.user.id, id);
  if (!goal) notFound();

  const notice = goal.notice as Notice | null;

  return (
    <>
      <AppHeader trail={["모든 세션", goal.title]} />
      <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
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
          </div>
        </header>

        {notice?.requirements?.length ? (
          <section>
            <h2 className="text-sm font-medium">
              자격 요건 {notice.requirements.length}
            </h2>
            <ul className="mt-2 space-y-1.5">
              {notice.requirements.map((item) => (
                <li key={item.text} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  {item.text}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {notice?.documents?.length ? (
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
    </>
  );
}
