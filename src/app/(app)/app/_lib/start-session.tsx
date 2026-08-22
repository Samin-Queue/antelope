"use client";

import { useEffect, useState } from "react";

import { Composer, type ModelOption } from "@/components/app/composer";
import { takePendingInput } from "@/components/app/pending-input";
import { Button } from "@/components/ui/button";

import { StartFlow, type StartInput } from "../start/_lib/start-flow";

/** 세션 하나 = 공고 하나에 대한 도전. 입력을 받으면 그 자리에서 워크벤치로 바뀐다. */
export function StartSession({
  greeting,
  user,
  models,
  resume,
}: {
  greeting: string;
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
  models: ModelOption[];
  /** 세션 화면에서 「이어서 준비」로 넘어온 경우. 컴포저를 건너뛴다 */
  resume?: { goalId: string; title: string } | null;
}) {
  const [input, setInput] = useState<StartInput | null>(
    resume ? { kind: "resume", goalId: resume.goalId } : null,
  );

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
    /**
     * 워크벤치는 **화면을 다 쓴다.**
     *
     * 여기 `max-w-5xl px-6 py-8` 이 있어서, 안쪽에서 좌우로 갈라 놓아도
     * 1024px 안에 갇혔다 — 넓은 모니터의 절반이 그냥 여백이었다. 입력 한 줄만
     * 머리에 두고 나머지는 격자와 산출물에 준다.
     */
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-6 py-2">
        <p className="truncate text-sm text-muted-foreground">
          {input.kind === "file"
            ? input.file.name
            : input.kind === "url"
              ? input.url
              : input.kind === "resume"
                ? `이어서 준비 — ${resume?.title ?? "지난 세션"}`
                : input.kind === "text"
                  ? input.text
                  : "지난 세션"}
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
      <div className="min-h-0 flex-1">
        <StartFlow initial={input} />
      </div>
    </div>
  );
}
