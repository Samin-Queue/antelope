import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { llmInfo } from "@/lib/llm";
import { AppHeader } from "@/components/app/app-header";
import { graphEdges, listMemories } from "@/app/(labs)/lab/notice/_lib/memory";

import { GoalList } from "./_lib/goal-list";
import { listGoals } from "./_lib/goals";
import { AppTabs } from "./_lib/tabs";
import { KnowledgeView } from "./knowledge/_lib/view";

export const dynamic = "force-dynamic";
export const metadata = { title: "워크스페이스" };

export default async function AppHomePage() {
  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;

  // 표시가 곧 사실이 되도록 실제 설정값에서 만든다. 하드코딩하지 않는다.
  const llm = llmInfo();
  const models =
    "error" in llm ? [] : [{ id: llm.model, label: llm.model, provider: llm.provider }];

  const [goals, memories, edges] = session
    ? await Promise.all([
        listGoals(session.user.id),
        listMemories(session.user.id),
        graphEdges(session.user.id),
      ])
    : [[], [], []];

  const name = session?.user.name?.split(" ")[0];
  const greeting = name ? `${name}님, 무엇을 신청할까요?` : "무엇을 신청할까요?";

  return (
    <>
      <AppHeader trail={["워크스페이스"]} />
      <AppTabs
        greeting={greeting}
        models={models}
        past={<GoalList goals={goals} />}
        knowledge={
          <KnowledgeView memories={memories} edges={edges} signedIn={Boolean(session)} />
        }
      />
    </>
  );
}
