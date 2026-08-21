import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { site } from "@/content/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-96 bg-[radial-gradient(55%_60%_at_50%_0%,color-mix(in_oklch,var(--brand),transparent_86%),transparent)]"
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-24 sm:py-32">
        <Badge variant="secondary" className="mb-6">
          {site.hero.eyebrow}
        </Badge>
        <h1 className="max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-6xl">
          {site.hero.headline}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
          {site.hero.sub}
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
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
      </div>
    </section>
  );
}
