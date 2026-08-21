import { headers } from "next/headers";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { AppHeader } from "@/components/app/app-header";
import { Button } from "@/components/ui/button";
import { graphEdges, listMemories } from "@/app/(labs)/lab/notice/_lib/memory";

import { KnowledgeEditor } from "./_lib/editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "지식" };

export default async function KnowledgePage() {
  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;

  if (!session) {
    return (
      <>
        <AppHeader trail={["워크스페이스", "지식"]} />
        <div className="mx-auto w-full max-w-5xl px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            지식은 계정에 쌓인다. 로그인하면 여기서 볼 수 있다.
          </p>
          <Button render={<Link href="/sign-in" />} className="mt-4">
            로그인
          </Button>
        </div>
      </>
    );
  }

  const [memories, edges] = await Promise.all([
    listMemories(session.user.id),
    graphEdges(session.user.id),
  ]);

  return (
    <>
      <AppHeader trail={["워크스페이스", "지식"]} />
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">기업 지식베이스</h1>
          <p className="text-sm text-muted-foreground">
            공고를 처리할 때마다 쌓인다. 다음 공고가 다른 이름으로 물어도 여기서 찾아
            채운다.
          </p>
        </header>
        <div className="mt-8">
          <KnowledgeEditor memories={memories} edges={edges} />
        </div>
      </div>
    </>
  );
}
