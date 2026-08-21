import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SymbolBadge } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { site } from "@/content/site";

export function Cta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-24">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_100%,color-mix(in_oklch,var(--brand),transparent_88%),transparent)]"
        />
        <div className="relative flex flex-col items-center gap-6">
          <SymbolBadge className="size-12" />
          <h2 className="max-w-lg text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {site.name} 을 지금 사용해 보세요
          </h2>
          <Button render={<Link href={site.cta.href} />} size="lg">
            {site.cta.label}
            <ArrowRight />
          </Button>
        </div>
      </div>
    </section>
  );
}
