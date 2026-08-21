import type { Metadata } from "next";

/**
 * 데모 사이트 전용 셸.
 *
 * 마케팅·앱·실험 어느 셸도 쓰지 않는다. 이 아래 페이지들은 "외부 기관 사이트"를
 * 흉내내는 것이 목적이라, 우리 헤더가 붙는 순간 검증 대상으로서 의미가 없어진다.
 * navbar 어디에도 링크하지 않고 URL 을 아는 사람만 들어온다.
 */
export const metadata: Metadata = {
  title: "데모 공고 사이트",
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white text-neutral-900">
      {children}
    </div>
  );
}
