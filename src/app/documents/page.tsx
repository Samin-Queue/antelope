import { llmInfo } from "@/lib/llm";
import { DocumentWorkbench } from "@/components/document-workbench";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

export default function DocumentsPage() {
  const info = llmInfo();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-5 py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">문서 파이프라인</h1>
          <p className="text-sm text-muted-foreground">
            업로드 → Upstage Document Parse → 구조화 결과 → JSON Schema 기반 정보 추출.
          </p>
          {"error" in info ? (
            <Badge variant="destructive">{info.error}</Badge>
          ) : (
            <Badge variant="secondary">{info.provider}</Badge>
          )}
        </header>
        <DocumentWorkbench />
      </main>
    </>
  );
}
