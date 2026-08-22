import { currentSession } from "@/lib/session";
import { AppHeader } from "@/components/app/app-header";

import { GoalList } from "../_lib/goal-list";
import { listGoals } from "../_lib/goals";

export const dynamic = "force-dynamic";
export const metadata = { title: "모든 세션" };

export default async function SessionsPage() {
  const session = await currentSession();
  const goals = session ? await listGoals(session.user.id) : [];

  return (
    <>
      <AppHeader trail={["모든 세션"]} />
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <GoalList goals={goals} />
      </div>
    </>
  );
}
