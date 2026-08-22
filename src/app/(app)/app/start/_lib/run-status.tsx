"use client";

import { cn } from "@/lib/utils";
import { Symbol } from "@/components/brand";

import type { Cards } from "./agent-grid";
import { CARD_LABEL, CARDS } from "./types";

/**
 * 격자 위 한 줄 — 지금 이 화면에서 무슨 일이 일어나고 있는가.
 *
 * 카드는 각자 자기 일만 말한다. 그래서 카드 사이의 공백(오케스트레이터가
 * 다음 말을 쓰는 시간)에는 아무 칸도 안 켜지고, 화면이 사실보다 조용해졌다.
 * 이 줄이 그 공백을 메운다 — **심볼이 브랜드색이면 오케스트레이터가 도는 중이다.**
 *
 * 상태는 전부 실제 이벤트에서 온다. 보이기 위해 켜지 않는다.
 */
export function RunStatus({
  cards,
  orchestrating,
  preparing,
  applying,
  className,
}: {
  cards: Cards;
  /** `{type:"orchestrator"}` 로 서버가 알려준 값 */
  orchestrating: boolean;
  preparing: boolean;
  applying: boolean;
  className?: string;
}) {
  const running = CARDS.filter((key) => cards[key].status === "running");
  const live = preparing || applying || orchestrating || running.length > 0;

  const line = orchestrating
    ? "Antelope가 에이전트들을 감독하고 있습니다…"
    : running.length > 1
      ? `${running.length}개 에이전트가 동시 작업 중입니다`
      : running.length === 1
        ? `${CARD_LABEL[running[0]]}${objectParticle(CARD_LABEL[running[0]])} 진행하고 있습니다`
        : live
          ? "Antelope가 다음 할 일을 정하고 있습니다…"
          : finished(cards);

  return (
    <div className={cn("flex flex-col items-center gap-3 py-6", className)}>
      <Symbol
        className={cn(
          "size-9 transition-colors",
          orchestrating ? "text-brand" : "text-muted-foreground",
        )}
      />
      <p
        className={cn(
          "text-center text-lg font-medium transition-colors",
          orchestrating ? "text-brand" : "text-foreground",
        )}
      >
        {line}
      </p>
    </div>
  );
}

/** 다 끝났을 때. 마지막으로 무엇을 했는지까지 말한다 */
function finished(cards: Cards): string {
  if (cards.browser.status === "done") return "신청까지 마쳤습니다";
  const errored = CARDS.filter((key) => cards[key].status === "error");
  if (errored.length > 0) return `${CARD_LABEL[errored[0]]}에서 막혔습니다`;
  if (CARDS.some((key) => cards[key].status === "done")) return "준비를 마쳤습니다";
  return "시작할 준비가 되었습니다";
}

/**
 * 을/를. 「계획 수립을」·「파일 에디터를」 — 받침이 갈라놓는다.
 * 한글 음절의 받침은 (코드 − 0xAC00) % 28 로 나온다.
 */
function objectParticle(word: string): string {
  const last = word.trim().at(-1);
  if (!last) return "를";
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "를";
  return (code - 0xac00) % 28 === 0 ? "를" : "을";
}
