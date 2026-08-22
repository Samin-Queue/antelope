import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { enabledProviders } from "@/lib/auth";
import { llmInfo } from "@/lib/llm";
import { currentSession } from "@/lib/session";
import { HeroComposer } from "@/components/sections/hero-composer";
import { HeroRotator } from "@/components/sections/hero-rotator";
import { site } from "@/content/site";

export async function Hero() {
  const session = await currentSession();

  // 모델 표시를 하드코딩하지 않는다. 랜딩에 보이는 것이 실제로 붙어 있는 것이다.
  const llm = llmInfo();
  const models =
    "error" in llm ? [] : [{ id: llm.model, label: llm.model, provider: llm.provider }];

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

      <div className="relative mx-auto w-full max-w-7xl px-5 pt-16 pb-10 sm:pt-24 sm:pb-12">
        <Link
          href={site.announcement.href}
          className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-card/60 py-1 pr-3 pl-1 text-sm backdrop-blur transition-colors hover:border-brand/50"
        >
          <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-white">
            {site.announcement.label}
          </span>
          <span className="text-muted-foreground">{site.announcement.text}</span>
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
        </Link>

        {/* 줄바꿈을 고정한다. 자동 줄바꿈에 맡기면 회전 문구가 줄 경계에 걸릴 때
            문장 전체가 재배치되어 튄다 */}
        <h1 className="mx-auto mt-10 max-w-4xl text-center heading-display text-[1.7rem] leading-[1.2] md:text-4xl lg:text-5xl">
          {site.hero.lead} <HeroRotator items={site.hero.rotating} />
          <br />
          {site.hero.tail}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg text-pretty text-muted-foreground">
          {site.hero.sub}
        </p>

        <div className="mt-10">
          <HeroComposer
            signedIn={Boolean(session)}
            providers={enabledProviders}
            models={models}
          />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">{site.hero.note}</p>
      </div>
    </section>
  );
}
