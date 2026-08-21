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
        className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(60%_60%_at_50%_50%,color-mix(in_oklch,var(--primary),transparent_88%),transparent)]"
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-24 sm:py-32">
        <Badge variant="secondary" className="mb-6">
          {site.hero.eyebrow}
        </Badge>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          {site.hero.headline}
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
          {site.hero.sub}
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button render={<Link href={site.cta.href} />} size="lg">
            {site.cta.label}
            <ArrowRight />
          </Button>
          <Button render={<Link href={site.repo} />} size="lg" variant="outline">
            GitHub
          </Button>
        </div>
      </div>
    </section>
  );
}
