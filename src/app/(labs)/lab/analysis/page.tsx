import { AnalysisWorkbench } from "./_lib/workbench";

export const dynamic = "force-dynamic";
export const metadata = { title: "정보 분석 · 신청 양식 설계" };

export default function AnalysisLabPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
      <header className="max-w-2xl space-y-3">
        <p className="font-mono text-xs tracking-wide text-brand">
          UPSTAGE STUDIO · 정보 분석
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          신청 공고를 양식 필드로 바꿉니다.
        </h1>
        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          공고와 보조 문서를 함께 올리세요. 정보 분석 에이전트가 신청 유형을 분류하고
          필요한 입력·서류 필드를 JSON으로 정리합니다.
        </p>
      </header>
      <div className="mt-10">
        <AnalysisWorkbench />
      </div>
    </div>
  );
}
