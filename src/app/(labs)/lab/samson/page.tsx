import { SamsonWorkbench } from "./_lib/workbench";

export const dynamic = "force-dynamic";
export const metadata = { title: "Samson · 문서 요약" };

export default function SamsonLabPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
      <header className="max-w-2xl space-y-3">
        <p className="font-mono text-xs tracking-wide text-brand">
          UPSTAGE STUDIO · SAMSON
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          문서를 하나의 Markdown으로 압축합니다.
        </h1>
        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          파일을 올리면 Samson이 원문을 읽고, 핵심 사실과 실행 정보를 판단해 바로 저장할
          수 있는 요약 문서를 만듭니다.
        </p>
      </header>
      <div className="mt-10">
        <SamsonWorkbench />
      </div>
    </div>
  );
}
