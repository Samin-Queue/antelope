import { AppHeader } from "@/components/app/app-header";
import { DocumentWorkbench } from "@/components/document-workbench";

export const dynamic = "force-dynamic";
export const metadata = { title: "문서" };

export default function DocumentsPage() {
  return (
    <>
      <AppHeader trail={["워크스페이스", "문서"]} />
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">문서 파이프라인</h1>
          <p className="text-sm text-muted-foreground">
            업로드 → 구조화 → JSON Schema 기반 정보 추출.
          </p>
        </header>
        <div className="mt-8">
          <DocumentWorkbench />
        </div>
      </div>
    </>
  );
}
