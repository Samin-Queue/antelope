import { headers } from "next/headers";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { Combination } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { site } from "@/content/site";

export async function SiteHeader({ marketing = false }: { marketing?: boolean }) {
  // DB 가 없으면 세션 조회 자체가 불가능하다 — 로그아웃 상태로 렌더한다.
  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-5">
        <Link href="/" aria-label="Antelope 홈" className="shrink-0">
          <Combination priority className="h-8 w-auto" />
        </Link>

        {marketing && (
          <nav className="hidden items-center gap-1 md:flex">
            {site.nav.map((item) => (
              <Button
                key={item.href}
                render={<Link href={item.href} />}
                variant="ghost"
                size="sm"
              >
                {item.label}
              </Button>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          {!marketing && (
            <>
              <Button render={<Link href="/documents" />} variant="ghost" size="sm">
                Documents
              </Button>
              <Button render={<Link href="/playground" />} variant="ghost" size="sm">
                Playground
              </Button>
            </>
          )}
          <ThemeToggle />
          {session ? (
            <UserMenu user={session.user} />
          ) : (
            <>
              <Button render={<Link href="/sign-in" />} variant="ghost" size="sm">
                로그인
              </Button>
              <Button render={<Link href={site.cta.href} />} size="sm">
                {site.cta.label}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
