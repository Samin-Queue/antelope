import Link from "next/link";
import { FlaskConical } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * 실험 전용 레이아웃. 프로덕션 화면과 눈으로 구분되어야
 * 데모 중에 실수로 실험을 보여주는 일이 없다.
 */
export default function LabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="border-b border-dashed border-brand/40 bg-brand/5">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-5 py-2 text-xs text-muted-foreground">
          <FlaskConical className="size-3.5 text-brand" />
          실험 영역 — 프로덕션 아님.
          <Link
            href="/lab"
            className="underline underline-offset-2 hover:text-foreground"
          >
            전체 실험 보기
          </Link>
          {/* 실험 화면에는 푸터가 없다. 테마 전환이 갈 데가 여기뿐이다 */}
          <ThemeToggle className="ml-auto" />
        </div>
      </div>
      <main className="flex-1">{children}</main>
    </>
  );
}
