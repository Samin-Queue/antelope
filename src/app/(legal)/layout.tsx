import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * 약관·방침 셸.
 *
 * 구글 OAuth 심사는 로그인 없이 열리는 공개 URL 을 요구한다 — 여기에
 * 인증 게이트를 걸면 심사가 되돌아온다.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-16">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
