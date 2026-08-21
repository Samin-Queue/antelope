import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, enabledProviders } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { Combination } from "@/components/brand";
import { SignInButtons } from "@/components/sign-in-buttons";
import { site } from "@/content/site";

export const dynamic = "force-dynamic";
export const metadata = { title: "로그인" };

export default async function SignInPage() {
  if (hasDb()) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session) redirect("/");
  }

  return (
    <main className="relative flex flex-1 items-center justify-center px-5 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_0%,color-mix(in_oklch,var(--brand),transparent_88%),transparent)]"
      />
      <div className="relative w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Link href="/">
            <Combination priority className="h-8 w-auto" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{site.name} 시작하기</h1>
            <p className="text-sm text-muted-foreground">{site.hero.sub}</p>
          </div>
        </div>

        <SignInButtons providers={enabledProviders} />

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          계속하면 {site.team} 의 서비스 약관과 개인정보 처리방침에 동의하는 것으로
          간주합니다.
        </p>
      </div>
    </main>
  );
}
