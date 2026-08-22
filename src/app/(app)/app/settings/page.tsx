import { googleConnections } from "@/lib/google";
import { currentSession } from "@/lib/session";
import { AppHeader } from "@/components/app/app-header";

import { GoogleConnections } from "./_lib/google-connections";

export const dynamic = "force-dynamic";
export const metadata = { title: "설정" };

export default async function SettingsPage() {
  const session = await currentSession();
  const connections = session ? await googleConnections() : [];

  return (
    <>
      <AppHeader trail={["워크스페이스", "설정"]} />
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">연동</h1>
          <p className="text-sm text-muted-foreground">
            로그인과 별개로, 필요한 권한만 그때그때 따로 받는다.
          </p>
        </header>

        <div className="mt-8">
          {session ? (
            <GoogleConnections connections={connections} signedIn />
          ) : (
            <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
              로그인하면 연동할 수 있습니다.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
