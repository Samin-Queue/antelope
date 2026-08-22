import { terms } from "@/content/legal";

import { LegalDocument } from "../_lib/document";

export const metadata = { title: "서비스 이용약관" };

export default function TermsPage() {
  return <LegalDocument {...terms} />;
}
