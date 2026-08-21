import { headers } from "next/headers";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { AppSidebar } from "@/components/app/app-sidebar";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";

/** 로그인한 사용자가 실제로 일하는 공간. 마케팅 화면과 셸이 다르다. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;

  return (
    <SidebarProvider>
      <AppSidebar
        footer={
          session ? (
            <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:justify-center">
              <UserMenu user={session.user} />
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm">{session.user.name ?? "사용자"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {session.user.email}
                </p>
              </div>
            </div>
          ) : (
            <Button
              render={<Link href="/sign-in" />}
              size="sm"
              className="group-data-[collapsible=icon]:hidden"
            >
              로그인
            </Button>
          )
        }
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
