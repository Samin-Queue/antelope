import { Hero } from "@/components/sections/hero";
import { Pillars } from "@/components/sections/pillars";
import { Steps } from "@/components/sections/steps";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Pillars />
        <Steps />
      </main>
      <SiteFooter />
    </>
  );
}
