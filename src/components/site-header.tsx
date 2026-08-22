import Link from "next/link";

import { currentSession } from "@/lib/session";
import { Combination } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { site } from "@/content/site";

export async function SiteHeader({ marketing = false }: { marketing?: boolean }) {
  const session = await currentSession();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="relative mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-5">
        <Link href="/" aria-label="Antelope 홈" className="shrink-0">
          <Combination priority className="h-6 w-auto" />
        </Link>

        {marketing && (
          // 로고·우측 액션의 폭에 흔들리지 않게 컨테이너 기준으로 가운데 고정한다
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
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
            <Button render={<Link href="/app" />} variant="ghost" size="sm">
              워크스페이스
            </Button>
          )}
          <ThemeToggle />
          {session ? (
            <>
              {/* 로그인해 있으면 랜딩에서 할 일은 하나다 — 앱으로 들어가는 것.
                  아바타 메뉴만 두면 그 길이 어디 있는지 안 보인다. */}
              <Button render={<Link href="/app" />} size="sm">
                앱으로 이동하기
              </Button>
              <UserMenu user={session.user} />
            </>
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
