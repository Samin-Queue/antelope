import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { SymbolBadge } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { site } from "@/content/site";

export function Cta() {
  return (
    <section className="relative overflow-hidden border-t border-border/60">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_100%,color-mix(in_oklch,var(--brand),transparent_84%),transparent)]"
      />
      <div className="relative mx-auto w-full max-w-5xl px-5 py-24 text-center">
        <SymbolBadge className="mx-auto size-12" />
        <h2 className="mx-auto mt-8 max-w-2xl heading-display text-3xl text-balance sm:text-4xl">
          {site.finalCta.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{site.finalCta.sub}</p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button render={<Link href={site.cta.href} />} size="lg">
            {site.cta.label}
            <ArrowRight />
          </Button>
          <Button
            render={<Link href={site.secondaryCta.href} />}
            size="lg"
            variant="outline"
          >
            {site.secondaryCta.label}
          </Button>
        </div>

        <ul className="mx-auto mt-14 grid max-w-3xl gap-x-8 gap-y-3 text-left sm:grid-cols-2">
          {site.finalCta.checklist.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-brand" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
