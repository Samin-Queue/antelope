import { AppHeader } from "@/components/app/app-header";
import { NoticeWorkbench } from "@/app/(labs)/lab/notice/_lib/workbench";

export const dynamic = "force-dynamic";
export const metadata = { title: "공고" };

export default function NoticesPage() {
  return (
    <>
      <AppHeader trail={["워크스페이스", "공고"]} />
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">공고 분석</h1>
          <p className="text-sm text-muted-foreground">
            공고문 파일, 사업 링크, 또는 그냥 말로 설명해도 된다.
          </p>
        </header>
        <div className="mt-8">
          <NoticeWorkbench />
        </div>
      </div>
    </>
  );
}
