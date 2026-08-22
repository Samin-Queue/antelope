"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

import { daysUntil, monthGrid, WEEKDAYS } from "./month";
import { MonthNav } from "./month-nav";

/** 마감. 세션 하나가 날짜 하나를 점유한다 */
export type Deadline = {
  id: string;
  title: string;
  organization: string | null;
  /** YYYY-MM-DD */
  date: string;
  closed: boolean;
};

export type CalendarEventVM = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  calendar: string;
  url: string | null;
};

/** 셀 하나에 세로로 쌓는 칩 수. 넘으면 +N 으로 접는다 (셀 높이 min-h-32 에 맞춤) */
const MAX_CHIPS = 4;
/** 모바일 셀의 점 개수 — 한 줄 5개 × 최대 3줄 */
const MAX_DOTS = 15;

type Chip = { key: string; title: string; kind: "deadline" | "event"; dim: boolean };

/**
 * 월간 보드.
 *
 * 마감이 먼저다 — 이 제품에서 날짜가 중요한 이유는 마감이고, 구글 일정은
 * 「그날 이미 바쁜가」를 알려주는 배경이다. 그래서 마감 칩이 위, 일정 칩이
 * 아래이고 점 색도 다르다.
 */
export function CalendarBoard({
  month,
  today,
  deadlines,
  events,
  holidays,
  connected,
}: {
  month: string;
  /** 서버가 준 오늘. 클라이언트 시계로 만들면 하이드레이션이 어긋난다 */
  today: string;
  deadlines: Deadline[];
  events: CalendarEventVM[];
  /**
   * YYYY-MM-DD → 공휴일명. 구글 공휴일 캘린더에서 온다.
   * 쉬는 날은 배경 정보라 **날짜 색으로만** 말한다 — 일정 줄은 지원 기간처럼
   * 실제로 읽어야 하는 것에 쓴다.
   */
  holidays: Record<string, string>;
  /** 구글 캘린더 연동 여부. 안 됐으면 안내를 띄운다 */
  connected: boolean;
}) {
  const [selected, setSelected] = useState<string>(() =>
    today.startsWith(month) ? today : `${month}-01`,
  );

  const cells = monthGrid(month);
  const deadlineByDay = groupBy(deadlines, (item) => item.date);
  const eventByDay = groupBy(events, (item) => item.date);

  const dayDeadlines = deadlineByDay[selected] ?? [];
  const dayEvents = eventByDay[selected] ?? [];

  return (
    <div className="flex flex-col gap-5">
      <MonthNav month={month} />

      <div className="flex flex-col gap-1.5">
        {/* 요일 헤더 — 본문 그리드와 같은 gap 으로 열을 맞춘다 */}
        <div className="grid grid-cols-7 gap-px">
          {WEEKDAYS.map((label, index) => (
            <div
              key={label}
              className={cn(
                "py-1 text-center text-xs font-medium",
                index === 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {label}
            </div>
          ))}
        </div>

        {/* 격자선을 border 로 그리면 셀마다 어느 변을 지울지 따져야 한다.
            gap-px + 배경색이면 1px 선이 저절로 생긴다. */}
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-border bg-border">
          {cells.map((cell) => (
            <DayCell
              key={cell.ymd}
              ymd={cell.ymd}
              inMonth={cell.inMonth}
              isToday={cell.ymd === today}
              isSelected={cell.ymd === selected}
              isRed={cell.weekday === 0 || holidays[cell.ymd] !== undefined}
              label={labelOf(deadlineByDay[cell.ymd] ?? [], cell.ymd, today)}
              chips={chipsOf(deadlineByDay[cell.ymd] ?? [], eventByDay[cell.ymd] ?? [])}
              onSelect={setSelected}
            />
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <header className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium tabular-nums">{selected}</h2>
          {holidays[selected] && (
            <span className="text-sm text-destructive">{holidays[selected]}</span>
          )}
          {dayDeadlines.length === 0 && dayEvents.length === 0 && (
            <span className="text-sm text-muted-foreground">아무것도 없다</span>
          )}
        </header>

        {dayDeadlines.length > 0 && (
          <ul className="mt-4 space-y-2">
            {dayDeadlines.map((item) => {
              const left = daysUntil(item.date, today);
              return (
                <li key={item.id}>
                  <Link
                    href={`/app/sessions/${item.id}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted"
                  >
                    <Badge variant={item.closed ? "outline" : "default"}>마감</Badge>
                    <span className="text-sm">{item.title}</span>
                    {item.organization && (
                      <span className="text-xs text-muted-foreground">
                        {item.organization}
                      </span>
                    )}
                    <span
                      className={cn(
                        "ml-auto font-mono text-xs",
                        left < 0
                          ? "text-muted-foreground"
                          : left <= 3
                            ? "text-destructive"
                            : "text-brand",
                      )}
                    >
                      {ddayLabel(left)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {dayEvents.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {dayEvents.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
                  {item.time ?? "종일"}
                </span>
                <span>{item.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {item.calendar}
                </span>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    aria-label="구글 캘린더에서 열기"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}

        {!connected && (
          <p className="mt-4 text-xs text-muted-foreground">
            구글 캘린더를 연동하면 그날 이미 잡힌 일정까지 같이 본다.{" "}
            <Link href="/app/settings" className="text-brand hover:underline">
              설정 · 연동
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}

/** 날짜 옆 라벨. 그날 가장 급한 마감의 D-day 만 보여준다. */
function labelOf(
  deadlines: Deadline[],
  ymd: string,
  today: string,
): { text: string; urgent: boolean } | null {
  if (deadlines.length === 0) return null;
  const left = daysUntil(ymd, today);
  const open = deadlines.some((item) => !item.closed);
  return { text: ddayLabel(left), urgent: open && left >= 0 && left <= 3 };
}

function ddayLabel(left: number): string {
  return left === 0 ? "D-DAY" : left > 0 ? `D-${left}` : `D+${-left}`;
}

function chipsOf(deadlines: Deadline[], events: CalendarEventVM[]): Chip[] {
  return [
    ...deadlines.map((item) => ({
      key: `d-${item.id}`,
      title: item.title,
      kind: "deadline" as const,
      dim: item.closed,
    })),
    ...events.map((item) => ({
      key: `e-${item.id}`,
      title: item.title,
      kind: "event" as const,
      dim: false,
    })),
  ];
}

/** 월간 그리드 셀 — 날짜 + D-day 라벨 + 마감·일정(칩/점). */
function DayCell({
  ymd,
  inMonth,
  isToday,
  isSelected,
  isRed,
  label,
  chips,
  onSelect,
}: {
  ymd: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isRed: boolean;
  label: { text: string; urgent: boolean } | null;
  chips: Chip[];
  onSelect: (ymd: string) => void;
}) {
  const day = Number(ymd.slice(8, 10));
  const shown = chips.slice(0, MAX_CHIPS);
  const more = chips.length - shown.length;

  return (
    <button
      type="button"
      onClick={() => onSelect(ymd)}
      aria-pressed={isSelected}
      className={cn(
        "flex min-h-20 flex-col gap-1 p-1 text-left align-top transition-colors sm:min-h-32 sm:p-1.5",
        // 이번 달이 아닌 셀도 배경은 같다. 흐린 날짜 숫자만으로 충분히 구분되고,
        // 배경까지 깔면 6주 그리드의 첫 줄·끝 줄이 통째로 다른 표처럼 보인다.
        "bg-card hover:bg-muted/40",
        // 다크에서 card 와 muted 의 차이가 거의 안 보인다. 선택은 브랜드 틴트로 잡는다.
        isSelected && "bg-brand/10 hover:bg-brand/15",
      )}
    >
      {/* 모바일은 날짜 아래로 세로 스택(겹침·잘림 방지), sm+ 는 좌우 배치 */}
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-1">
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full text-xs tabular-nums",
            isToday
              ? "bg-brand font-semibold text-brand-foreground"
              : !inMonth
                ? "text-muted-foreground/50"
                : isRed
                  ? "text-destructive"
                  : "text-foreground",
          )}
        >
          {day}
        </span>
        {label && (
          <span
            className={cn(
              "truncate px-0.5 font-mono text-xs sm:px-0",
              label.urgent ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {label.text}
          </span>
        )}
      </div>

      {chips.length > 0 && (
        <>
          {/* 데스크톱(sm+): 제목 칩 */}
          <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
            {shown.map((chip) => (
              <span
                key={chip.key}
                className="flex h-5 w-full items-center gap-1.5 rounded-md bg-muted px-1.5 text-[0.7rem] leading-none"
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    chip.kind === "deadline" && !chip.dim
                      ? "bg-brand"
                      : "bg-muted-foreground/50",
                  )}
                />
                <span
                  className={cn(
                    "truncate",
                    chip.kind === "deadline" && !chip.dim
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {chip.title}
                </span>
              </span>
            ))}
            {more > 0 && (
              <span className="px-1 text-[0.65rem] text-muted-foreground">+{more}</span>
            )}
          </div>

          {/* 모바일: 점 — 한 줄 5개 × 최대 3줄 */}
          <div className="flex flex-col gap-0.5 sm:hidden">
            <div className="grid grid-cols-[repeat(5,0.375rem)] gap-0.5">
              {chips.slice(0, MAX_DOTS).map((chip) => (
                <span
                  key={chip.key}
                  className={cn(
                    "size-1.5 rounded-full",
                    chip.kind === "deadline" && !chip.dim
                      ? "bg-brand"
                      : "bg-muted-foreground/50",
                  )}
                />
              ))}
            </div>
            {chips.length > MAX_DOTS && (
              <span className="text-[0.6rem] leading-none text-muted-foreground">
                +{chips.length - MAX_DOTS}
              </span>
            )}
          </div>
        </>
      )}
    </button>
  );
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) (out[key(item)] ??= []).push(item);
  return out;
}
