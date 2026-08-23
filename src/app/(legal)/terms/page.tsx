import { socialMetadata } from "@/lib/og";
import { terms } from "@/content/legal";
import { site } from "@/content/site";

import { LegalDocument } from "../_lib/document";

export const metadata = {
  title: "서비스 이용약관",
  description: terms.intro,
  alternates: { canonical: "/terms" },
  ...socialMetadata({
    title: `서비스 이용약관 · ${site.name}`,
    description: terms.intro,
    path: "/terms",
    type: "article",
  }),
};

export default function TermsPage() {
  return <LegalDocument {...terms} />;
}
