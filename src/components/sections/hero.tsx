import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { site } from "@/content/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* 브랜드 컬러 글로우 — 다크 배경 위에서만 의미가 있다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-[32rem] bg-[radial-gradient(50%_55%_at_50%_0%,color-mix(in_oklch,var(--brand),transparent_80%),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,color-mix(in_oklch,var(--foreground),transparent_96%)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--foreground),transparent_96%)_1px,transparent_1px)] [mask-image:radial-gradient(70%_50%_at_50%_0%,black,transparent)] [background-size:64px_64px]"
      />

      <div className="relative mx-auto w-full max-w-7xl px-5 pt-16 pb-24 sm:pt-24 sm:pb-32">
        <Link
          href={site.announcement.href}
          className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-card/60 py-1 pr-3 pl-1 text-sm backdrop-blur transition-colors hover:border-brand/50"
        >
          <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-white">
            {site.announcement.label}
          </span>
          <span className="text-muted-foreground">{site.announcement.text}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
        </Link>

        <h1 className="mx-auto mt-10 max-w-4xl text-center heading-display text-4xl leading-[1.12] text-balance sm:text-6xl">
          {site.hero.headline}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg text-pretty text-muted-foreground">
          {site.hero.sub}
        </p>

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
        <p className="mt-4 text-center text-xs text-muted-foreground">{site.hero.note}</p>
      </div>
    </section>
  );
}
