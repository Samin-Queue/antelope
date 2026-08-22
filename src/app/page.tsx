import { About } from "@/components/sections/about";
import { Comparison } from "@/components/sections/comparison";
import { Cta } from "@/components/sections/cta";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { Memory } from "@/components/sections/memory";
import { Pipeline } from "@/components/sections/pipeline";
import { Steps } from "@/components/sections/steps";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/content/site";

/**
 * 구글 심사·검색엔진이 앱 이름과 목적을 구조화된 형태로도 읽게 한다.
 * 화면의 `<About />` 과 같은 사실을 말해야 한다 — 한쪽만 고치지 않는다.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.about.name,
  alternateName: `${site.name} · ${site.tagline}`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: site.url,
  description: site.about.purposeEn,
  inLanguage: "ko-KR",
  offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
  publisher: { "@type": "Organization", name: site.team, url: site.repo },
  privacyPolicy: `${site.url}/privacy`,
  termsOfService: `${site.url}/terms`,
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // 우리가 만든 리터럴이다. 사용자 입력이 섞이지 않는다.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader marketing />
      <main className="flex-1">
        <Hero />
        <Steps />
        <Features />
        <Memory />
        <Comparison />
        <Pipeline />
        <Cta />
        <About />
      </main>
      <SiteFooter />
    </>
  );
}
