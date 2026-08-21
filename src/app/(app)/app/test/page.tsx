import { AppHeader } from "@/components/app/app-header";

export const metadata = { title: "테스트" };

export default function TestPage() {
  return (
    <>
      <AppHeader trail={["도구", "테스트"]} />
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <h1 className="text-xl font-semibold tracking-tight">
          테스트로 김시윤이 추가한 페이지
        </h1>
      </div>
    </>
  );
}
