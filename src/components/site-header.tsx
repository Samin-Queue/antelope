import { headers } from "next/headers";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";

export async function SiteHeader() {
  // DB 가 없으면 세션 조회 자체가 불가능하다 — 로그아웃 상태로 렌더한다.
  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="Antelope 홈">
          <Wordmark priority className="h-5 w-auto" />
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Button render={<Link href="/documents" />} variant="ghost" size="sm">
            Documents
          </Button>
          <Button render={<Link href="/playground" />} variant="ghost" size="sm">
            Playground
          </Button>
          <ThemeToggle />
          {session ? (
            <UserMenu user={session.user} />
          ) : (
            <Button render={<Link href="/sign-in" />} size="sm">
              로그인
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
