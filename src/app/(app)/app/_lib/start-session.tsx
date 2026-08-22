"use client";

import { useEffect, useState } from "react";

import {
  Composer,
  type ComposerSubmit,
  type ModelOption,
} from "@/components/app/composer";
import { takePendingInput } from "@/components/app/pending-input";
import { Button } from "@/components/ui/button";

import { StartFlow } from "../start/_lib/start-flow";

/** 세션 하나 = 공고 하나에 대한 도전. 입력을 받으면 그 자리에서 워크벤치로 바뀐다. */
export function StartSession({
  greeting,
  user,
  models,
}: {
  greeting: string;
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
  models: ModelOption[];
}) {
  const [input, setInput] = useState<ComposerSubmit | null>(null);

  // 랜딩 히어로에 넣고 온 입력을 이어받는다. 다시 입력하게 하지 않는다.
  //
  // 마운트 후에 읽어야 한다 — 초기 렌더에서 읽으면 서버에는 없는 값이라
  // 하이드레이션이 어긋난다. 그래서 effect 안에서의 setState 가 여기서는 맞다.
  useEffect(() => {
    const held = takePendingInput();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (held) setInput(held);
  }, []);

  if (!input) {
    return (
      <div className="flex min-h-[calc(100svh-3.5rem)] flex-col">
        <Composer greeting={greeting} user={user} models={models} onSubmit={setInput} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
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
        <StartFlow initial={input} />
      </div>
    </div>
  );
}
