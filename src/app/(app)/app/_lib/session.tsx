"use client";

import { useState } from "react";

import {
  Composer,
  type ComposerSubmit,
  type ModelOption,
} from "@/components/app/composer";
import { Button } from "@/components/ui/button";
import { NoticeWorkbench } from "@/app/(labs)/lab/notice/_lib/workbench";

/**
 * 세션 하나. 컴포저로 시작해 같은 화면에서 파이프라인으로 이어진다.
 * 페이지를 옮기지 않는 이유는 File 을 네비게이션 너머로 넘길 수 없어서다.
 */
export function AppSession({
  greeting,
  models,
}: {
  greeting: string;
  models: ModelOption[];
}) {
  const [input, setInput] = useState<ComposerSubmit | null>(null);

  if (!input) return <Composer greeting={greeting} models={models} onSubmit={setInput} />;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-center gap-2">
        <p className="truncate text-sm text-muted-foreground">
          {input.kind === "file"
            ? input.file.name
            : input.kind === "url"
              ? input.url
              : input.text}
        </p>
        <Button
          variant="ghost"
          size="xs"
          className="ml-auto"
          onClick={() => setInput(null)}
        >
          새 세션
        </Button>
      </div>
      <div className="mt-6">
        <NoticeWorkbench initial={input} />
      </div>
    </div>
  );
}
