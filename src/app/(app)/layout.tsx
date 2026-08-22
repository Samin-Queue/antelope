import { redirect } from "next/navigation";

import { currentSession } from "@/lib/session";
import { AppSidebar } from "@/components/app/app-sidebar";
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

  return (
    <SidebarProvider>
      <AppSidebar
        sessions={goals.map((goal) => ({
          id: goal.id,
          title: goal.title,
          organization: goal.organization,
        }))}
        user={session.user}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
