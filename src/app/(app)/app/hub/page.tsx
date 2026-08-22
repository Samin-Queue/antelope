import { currentSession } from "@/lib/session";
import { AppHeader } from "@/components/app/app-header";
import { listDocuments } from "@/app/(app)/app/start/_lib/documents";
import { graphEdges, listMemories } from "@/app/(labs)/lab/notice/_lib/memory";

import { KnowledgeView } from "../knowledge/_lib/view";

export const dynamic = "force-dynamic";
export const metadata = { title: "데이터 허브" };

/** 세션을 거치며 쌓인 것이 모이는 자리. 다음 세션이 여기서 답을 꺼내 쓴다. */
export default async function HubPage() {
  const session = await currentSession();

  const [memories, edges, documents] = session
    ? await Promise.all([
        listMemories(session.user.id),
        graphEdges(session.user.id),
        listDocuments(session.user.id),
      ])
    : [[], [], []];

  return (
    <>
      <AppHeader trail={["데이터 허브"]} />
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <KnowledgeView
          memories={memories}
          edges={edges}
          documents={documents}
          signedIn={Boolean(session)}
        />
      </div>
    </>
  );
}
