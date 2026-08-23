import { socialMetadata } from "@/lib/og";
import { privacy } from "@/content/legal";
import { site } from "@/content/site";

import { LegalDocument } from "../_lib/document";

export const metadata = {
  title: "개인정보처리방침",
  description: privacy.intro,
  alternates: { canonical: "/privacy" },
  ...socialMetadata({
    title: `개인정보처리방침 · ${site.name}`,
    description: privacy.intro,
    path: "/privacy",
    type: "article",
  }),
};

export default function PrivacyPage() {
  return <LegalDocument {...privacy} />;
}
