"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** 데모 도중 예외가 나도 흰 화면 대신 복구 버튼을 보여준다. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">문제가 발생했습니다</h1>
      <p className="max-w-md font-mono text-sm break-words text-muted-foreground">
        {error.message}
      </p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
