import { privacy } from "@/content/legal";

import { LegalDocument } from "../_lib/document";

export const metadata = { title: "개인정보처리방침" };

export default function PrivacyPage() {
  return <LegalDocument {...privacy} />;
}
