import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { llmInfo } from "@/lib/llm";
import { currentSession } from "@/lib/session";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AssistantProvider, AssistantSidebar } from "@/components/app/assistant-panel";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { listGoals } from "./app/_lib/goals";

/**
 * 로그인한 사용자가 실제로 일하는 공간. 마케팅 화면과 셸이 다르다.
 *
 * 문은 `src/proxy.ts` 가 지킨다 — 여기까지 세션 없이 오는 경로는 없어야 한다.
 * 그래도 한 겹 더 둔다. 프록시 matcher 는 문자열 상수라 경로를 옮기거나 그룹을
 * 바꾸면 **조용히 커버리지가 빠진다**. 그때 앱이 그냥 열리는 것보다 로그인
 * 화면으로 튕기는 편이 낫다.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/sign-in?next=%2Fapp");

  // 사이드바가 지난 세션을 직접 펼쳐 보이므로 셸에서 한 번만 읽는다.
  const goals = await listGoals(session.user.id);

  // 어시스턴트를 열어 둔 채 새로고침해도 그대로 열려 있게 한다.
  const jar = await cookies();
  const assistantOpen = jar.get("assistant_state")?.value === "true";

  // 키가 없으면 `error` 만 온다. 그때는 모델 표시를 그리지 않는다.
  const llm = llmInfo();
  const model = "error" in llm ? null : { provider: llm.provider, id: llm.model };

  return (
    <AssistantProvider model={model} defaultOpen={assistantOpen}>
      <SidebarProvider>
        <AppSidebar
          sessions={goals.map((goal) => ({
            id: goal.id,
            title: goal.title,
            organization: goal.organization,
          }))}
          user={session.user}
        />
        {/*
          `min-w-0` 이 없으면 이 칸이 **줄어들지 않는다.** 플렉스 아이템 기본
          `min-width: auto` 라 안쪽 내용의 min-content 만큼 자라고, 넓은 표나
          긴 값 하나가 화면 전체를 가로로 밀어낸다 — 사이드바까지 잘렸다.
        */}
        <SidebarInset className="min-w-0">{children}</SidebarInset>
        {/* 셸에 한 번만 둔다 — 화면을 옮겨 다녀도 대화가 이어져야 한다 */}
        <AssistantSidebar />
      </SidebarProvider>
    </AssistantProvider>
  );
}
