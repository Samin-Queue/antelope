import { Comparison } from "@/components/sections/comparison";
import { Cta } from "@/components/sections/cta";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { Memory } from "@/components/sections/memory";
import { Pipeline } from "@/components/sections/pipeline";
import { Steps } from "@/components/sections/steps";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader marketing />
      <main className="flex-1">
        <Hero />
        <Steps />
        <Features />
        <Memory />
        <Comparison />
        <Pipeline />
        <Cta />
      </main>
      <SiteFooter />
    </>
  );
}
