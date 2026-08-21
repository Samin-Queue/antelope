import { NoticeWorkbench } from "./_lib/workbench";

export const dynamic = "force-dynamic";
export const metadata = { title: "공고 → 신청 준비" };

export default function NoticeLabPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">공고 → 신청 준비 일습</h1>
        <p className="text-sm text-muted-foreground">
          공고문 파일, 사업 링크, 또는 그냥 말로 설명해도 된다. 무엇을 넣든 같은 「공고
          객체」로 수렴한다.
        </p>
      </header>
      <div className="mt-8">
        <NoticeWorkbench />
      </div>
    </div>
  );
}
