import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { llmInfo } from "@/lib/llm";
import { AppHeader } from "@/components/app/app-header";

import { AppSession } from "./_lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "새 세션" };

export default async function AppHomePage() {
  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;

  // 표시가 곧 사실이 되도록 실제 설정값에서 만든다. 하드코딩하지 않는다.
  const llm = llmInfo();
  const models =
    "error" in llm ? [] : [{ id: llm.model, label: llm.model, provider: llm.provider }];

  const name = session?.user.name?.split(" ")[0];
  const greeting = name ? `${name}님, 어떤 공고를 볼까요?` : "어떤 공고를 볼까요?";

  return (
    <>
      <AppHeader trail={["새 세션"]} />
      <AppSession greeting={greeting} models={models} />
    </>
  );
}
