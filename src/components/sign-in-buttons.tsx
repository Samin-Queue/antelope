"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

const LABELS = { google: "Google 로 계속하기", github: "GitHub 로 계속하기" } as const;

type Provider = keyof typeof LABELS;

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.55Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.11 0 5.72-1.03 7.62-2.8l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.03-6.45-4.75H1.71v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.16a6.9 6.9 0 0 1 0-4.32V6.86H1.71a11.5 11.5 0 0 0 0 10.28l3.84-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.69 0 3.2.58 4.4 1.72l3.3-3.3C17.72 1.3 15.1.5 12 .5A11.5 11.5 0 0 0 1.71 6.86l3.84 2.98C6.46 7.12 9 4.77 12 4.77Z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.41-2.68 5.38-5.24 5.67.41.35.78 1.05.78 2.12v3.14c0 .31.2.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

export function SignInButtons({
  providers,
  callbackURL = "/app",
}: {
  providers: Provider[];
  callbackURL?: string;
}) {
  const [pending, setPending] = useState<Provider | null>(null);

  if (providers.length === 0) {
    return (
      <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
        로그인 프로바이더가 설정되지 않았습니다. <code>GOOGLE_CLIENT_ID</code> 또는{" "}
        <code>GITHUB_CLIENT_ID</code> 를 확인하세요.
      </p>
    );
  }

  async function start(provider: Provider) {
    setPending(provider);
    const { error } = await signIn.social({ provider, callbackURL });
    if (error) {
      setPending(null);
      toast.error(error.message ?? "로그인에 실패했습니다.");
    }
    // 성공하면 프로바이더로 리다이렉트되므로 pending 을 풀지 않는다.
  }

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => (
        <Button
          key={provider}
          variant="outline"
          size="lg"
          className="w-full justify-center"
          disabled={pending !== null}
          onClick={() => start(provider)}
        >
          {pending === provider ? (
            <Loader2 className="animate-spin" />
          ) : provider === "google" ? (
            <GoogleMark />
          ) : (
            <GitHubMark />
          )}
          {LABELS[provider]}
        </Button>
      ))}
    </div>
  );
}
