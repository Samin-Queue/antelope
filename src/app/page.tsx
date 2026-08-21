import { Comparison } from "@/components/sections/comparison";
import { Cta } from "@/components/sections/cta";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { Integrations } from "@/components/sections/integrations";
import { Proof } from "@/components/sections/proof";
import { Stats } from "@/components/sections/stats";
import { Testimonial } from "@/components/sections/testimonial";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader marketing />
      <main className="flex-1">
        <Hero />
        <Proof />
        <Stats />
        <Features />
        <Testimonial />
        <Comparison />
        <Integrations />
        <Cta />
      </main>
      <SiteFooter />
    </>
  );
}
