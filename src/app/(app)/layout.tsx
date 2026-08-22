import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { AppSidebar } from "@/components/app/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { listGoals } from "./app/_lib/goals";

/** 로그인한 사용자가 실제로 일하는 공간. 마케팅 화면과 셸이 다르다. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;

  // 사이드바가 지난 세션을 직접 펼쳐 보이므로 셸에서 한 번만 읽는다.
  const goals = session ? await listGoals(session.user.id) : [];

  return (
    <SidebarProvider>
      <AppSidebar
        sessions={goals.map((goal) => ({
          id: goal.id,
          title: goal.title,
          organization: goal.organization,
        }))}
        user={session?.user ?? null}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
