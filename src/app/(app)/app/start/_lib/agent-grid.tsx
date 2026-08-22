"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CircleCheck,
  FileSearch,
  ListChecks,
  Loader2,
  MonitorPlay,
  PenLine,
  Table2,
  Target,
  Telescope,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  /**
   * 이 칸이 실제로 무엇으로 돌았는지 — `Studio 유효성 검사` / `Solar 직접 호출`.
   * 고정 라벨을 붙이면 Studio 가 죽고 Solar 로 떨어진 날 카드가 거짓말을 한다.
   */
  via?: string;
};

/**
 * 카드마다 아이콘 하나.
 *
 * 일곱 칸이 글자만으로 서 있으면 어느 것이 도는지 훑어서 안 잡힌다 — 라벨을
 * 읽어야 구분된다. 아이콘은 **그 에이전트가 실제로 하는 일**에서 고른다:
 * 조준(목표) · 망원경(멀리서 모아 옴) · 문서 돋보기(읽어서 구조화) ·
 * 체크리스트(순서) · 표(마스터 테이블) · 펜(작성) · 화면(실제 조작).
 */
export const CARD_ICON: Record<CardKey, LucideIcon> = {
  goal: Target,
  gather: Telescope,
  analyze: FileSearch,
  plan: ListChecks,
  data: Table2,
  file: PenLine,
  browser: MonitorPlay,
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
  const Icon = CARD_ICON[card];

  return (
    <section
      className={cn(
        "flex min-h-40 flex-col rounded-2xl border bg-card p-5 transition-colors",
        running ? "border-brand" : "border-border",
        state.status === "error" && "border-destructive/60",
        (state.status === "idle" || state.status === "skip") && "opacity-50",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="flex items-center gap-2 text-base font-medium">
            <Icon
              className={cn(
                "size-4 shrink-0",
                running
                  ? "text-brand"
                  : state.status === "done"
                    ? "text-foreground/70"
                    : state.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground",
              )}
            />
            {CARD_LABEL[card]}
            {running && <Loader2 className="size-4 animate-spin text-brand" />}
            {/*
              끝난 칸을 초록 체크 하나로 못박는다. 상태가 아이콘 색에만 실려
              있어서 「끝난 것」과 「아직 안 돈 것」이 회색 두 단계로만 갈렸다 —
              일곱 칸을 훑을 때 어디까지 왔는지가 안 잡힌다.
            */}
            {state.status === "done" && (
              <CircleCheck className="size-4 shrink-0 text-emerald-500" />
            )}
          </h3>

          <p
            className={cn(
              "mt-1 text-sm",
              running ? "text-brand" : "text-muted-foreground",
            )}
          >
            {state.headline ??
              (state.status === "idle"
                ? "대기"
                : state.status === "skip"
                  ? "건너뜀"
                  : "…")}
          </p>

          {state.body && <CardBody title={CARD_LABEL[card]} body={state.body} />}

          {state.via && (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
              {state.via}
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

/**
 * 카드 본문 — 3줄에서 자르고, 넘치면 넷째 줄에 「더보기」를 둔다.
 *
 * 카드 높이가 본문을 따라 늘면 일곱 칸 격자가 통째로 어긋난다. 그렇다고 그냥
 * 잘라 두면 잘렸다는 사실 자체가 안 보여서, 사용자는 문장이 거기서 끝난 줄 안다.
 *
 * 넘치는지는 **재어서** 판단한다. 글자 수로 어림하면 카드 폭·글꼴·줄바꿈에
 * 따라 틀리고, 안 넘치는데 「더보기」가 붙으면 눌러도 같은 글이 뜬다.
 */
function CardBody({ title, body }: { title: string; body: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [clipped, setClipped] = useState(false);
  const [open, setOpen] = useState(false);

  // 레이아웃 확정 뒤에 재야 한다. `useEffect` 로 재면 첫 프레임에 「더보기」가
  // 없다가 뒤늦게 붙어 카드가 한 번 튄다.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setClipped(node.scrollHeight - node.clientHeight > 1);
    measure();
    // 카드 폭은 격자·사이드바·창 크기로 바뀐다. 폭이 줄면 3줄이던 글이 4줄이
    // 되므로 한 번 재고 마는 것으로는 부족하다.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [body]);

  // 웹폰트가 늦게 붙으면 줄 수가 달라진다. 폰트 로딩 뒤 한 번 더 잰다.
  useEffect(() => {
    const node = ref.current;
    if (!node || !document.fonts) return;
    let alive = true;
    void document.fonts.ready.then(() => {
      if (alive) setClipped(node.scrollHeight - node.clientHeight > 1);
    });
    return () => {
      alive = false;
    };
  }, [body]);

  return (
    <>
      <p
        ref={ref}
        className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground"
      >
        {body}
      </p>

      {clipped && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-0.5 w-fit text-sm leading-relaxed text-brand hover:underline"
        >
          더보기
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">에이전트 설명 전문</DialogDescription>
          </DialogHeader>
          <p className="max-h-[60vh] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {body}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
