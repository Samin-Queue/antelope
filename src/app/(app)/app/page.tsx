import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { AppHeader } from "@/components/app/app-header";

import { AppSession } from "./_lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "새 세션" };

export default async function AppHomePage() {
  const session = hasDb()
    ? await auth.api.getSession({ headers: await headers() })
    : null;

  const name = session?.user.name?.split(" ")[0];
  const greeting = name ? `${name}님, 어떤 공고를 볼까요?` : "어떤 공고를 볼까요?";

  return (
    <>
      <AppHeader trail={["새 세션"]} />
      <AppSession greeting={greeting} />
    </>
  );
}
