import { llmInfo } from "@/lib/llm";
import { currentSession } from "@/lib/session";
import { AppHeader } from "@/components/app/app-header";

import { getGoal } from "./_lib/goals";
import { StartSession } from "./_lib/start-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "세션 시작하기" };

export default async function AppHomePage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string }>;
}) {
  const session = await currentSession();
  const { resume: resumeId } = await searchParams;

  // 표시가 곧 사실이 되도록 실제 설정값에서 만든다. 하드코딩하지 않는다.
  const llm = llmInfo();
  const models =
    "error" in llm ? [] : [{ id: llm.model, label: llm.model, provider: llm.provider }];

  /**
   * 세션 화면의 「이어서 준비」에서 넘어온 경우.
   *
   * 여기서 스냅샷까지 읽어 제목만 넘긴다 — 없는 세션이면 그냥 컴포저를 띄운다.
   * 「이어받을 게 없다」를 굳이 화면으로 만들 만큼 흔한 일이 아니다.
   */
  const goal =
    resumeId && session
      ? await getGoal(session.user.id, resumeId).catch(() => null)
      : null;

  const name = session?.user.name?.split(" ")[0];
  const greeting = name ? `${name}님, 무엇을 신청할까요?` : "무엇을 신청할까요?";

  return (
    <>
      <AppHeader trail={["세션 시작하기"]} />
      <StartSession
        greeting={greeting}
        user={session?.user ?? null}
        models={models}
        resume={goal ? { goalId: goal.id, title: goal.title } : null}
      />
    </>
  );
}
