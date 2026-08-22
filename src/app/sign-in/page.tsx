import Link from "next/link";
import { redirect } from "next/navigation";

import { enabledProviders } from "@/lib/auth";
import { GOOGLE_ALL_SCOPES } from "@/lib/google-scopes";
import { currentSession } from "@/lib/session";
import { Combination } from "@/components/brand";
import { SignInButtons } from "@/components/sign-in-buttons";
import { site } from "@/content/site";

export const dynamic = "force-dynamic";
export const metadata = { title: "로그인" };

/** `?next=` 는 사용자가 손댈 수 있는 값이다. 같은 출처의 경로만 통과시킨다. */
function safeNext(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "/app";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const next = safeNext((await searchParams).next);

  // 이미 로그인해 있으면 여기 머물 이유가 없다. 랜딩으로 되돌리면 「로그인을
  // 눌렀는데 아무 일도 안 일어난다」로 보인다 — 가려던 곳으로 보낸다.
  const session = await currentSession();
  if (session) redirect(next);

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

        <SignInButtons
          providers={enabledProviders}
          callbackURL={next}
          googleScopes={GOOGLE_ALL_SCOPES}
        />

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          계속하면 {site.team} 의 서비스 약관과 개인정보 처리방침에 동의하는 것으로
          간주합니다.
        </p>
      </div>
    </main>
  );
}
