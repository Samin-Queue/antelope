"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { CARD_LABEL, type CardKey } from "./types";

/**
 * 카드 하나 = 에이전트 하나.
 *
 * 로그를 흘리지 않는다. `parse → classify → extract-grant` 는 개발자만 읽는다 —
 * 사용자가 알아야 하는 것은 **무엇을 알아냈고 그래서 다음이 무엇인가**이고,
 * 그 문장은 오케스트레이터(`narrator.ts`)가 쓴다.
 *
 * **켜진 테두리는 실제로 도는 것만이다.** 브라우저가 도중에 데이터·파일·계획을
 * 되부르면 그 칸이 함께 켜진다. 보이기 위해 임의로 켜지 않는다.
 */
export type CardState = {
  status: "idle" | "running" | "done" | "error" | "skip";
  /** 상태 한 줄 — 「정보 수집 완료 · 39개 출처 탐색됨」 */
  headline?: string;
  /** 두세 문장 */
  body?: string;
  /** 눌러서 볼 산출물이 있으면 그 이름 */
  action?: string;
};

export type Cards = Record<CardKey, CardState>;

export function emptyCards(): Cards {
  const cards = {} as Cards;
  for (const key of [
    "goal",
    "gather",
    "analyze",
    "plan",
    "data",
    "file",
    "browser",
  ] as CardKey[]) {
    cards[key] = { status: "idle" };
  }
  return cards;
}

export function AgentCard({
  card,
  state,
  onOpen,
  className,
  children,
}: {
  card: CardKey;
  state: CardState;
  onOpen?: () => void;
  className?: string;
  /** 브라우저 카드의 라이브 썸네일처럼 옆에 붙는 것 */
  children?: React.ReactNode;
}) {
  const running = state.status === "running";

  return (
    <section
      className={cn(
        "flex min-h-40 flex-col rounded-2xl border bg-card p-5 transition-colors",
        running ? "border-brand" : "border-border",
        state.status === "error" && "border-destructive/60",
        state.status === "idle" && "opacity-50",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="flex items-center gap-2 text-base font-medium">
            {CARD_LABEL[card]}
            {running && <Loader2 className="size-4 animate-spin text-brand" />}
          </h3>

          <p
            className={cn(
              "mt-1 text-sm",
              running ? "text-brand" : "text-muted-foreground",
            )}
          >
            {state.headline ?? (state.status === "idle" ? "대기" : "…")}
          </p>

          {state.body && (
            // 4줄에서 자른다. 카드가 늘면 격자가 어긋나고, 전문은 오른쪽에 있다.
            <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
              {state.body}
            </p>
          )}

          {state.action && onOpen && (
            <Button variant="outline" size="xs" className="mt-3 w-fit" onClick={onOpen}>
              {state.action}
            </Button>
          )}
        </div>

        {children}
      </div>
    </section>
  );
}
