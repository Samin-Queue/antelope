import Link from "next/link";

import { Combination } from "@/components/brand";
import { site } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto w-full max-w-7xl px-5 py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-4">
            <Combination className="h-9 w-auto" />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {site.description}
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {site.footer.map((column) => (
              <div key={column.title}>
                <h3 className="text-sm font-medium">{column.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((label) => (
                    <li key={label}>
                      <span className="text-sm text-muted-foreground">{label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-border/60 pt-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{site.team} · JunctionX Korea 2026 · 포항 · 8월 21–23일</span>
          <Link href={site.repo} className="hover:text-foreground">
            GitHub
          </Link>
        </div>
      </div>
    </footer>
  );
}
