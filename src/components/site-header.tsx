import Link from "next/link";

import { Button } from "@/components/ui/button";
import { site } from "@/content/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
        <Link href="/" className="font-semibold tracking-tight">
          {site.name}
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Button render={<Link href="/playground" />} variant="ghost" size="sm">
            Playground
          </Button>
          <Button render={<Link href={site.cta.href} />} size="sm">
            {site.cta.label}
          </Button>
        </nav>
      </div>
    </header>
  );
}
