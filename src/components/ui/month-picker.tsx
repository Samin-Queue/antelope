"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 월 선택기 — shadcn 에 없어 직접 만든다. 연도 헤더(◀ YYYY ▶) + 3열 월 그리드.
 * `value` 는 'YYYY-MM'.
 */
export function MonthPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (month: string) => void;
}) {
  const selectedYear = Number(value.slice(0, 4));
  const selectedMonth = Number(value.slice(5, 7));
  // 열릴 때 선택된 달의 연도로 시작한다. 팝오버가 재마운트되며 초기화된다.
  const [year, setYear] = useState(selectedYear);

  return (
    <div className="w-64 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="이전 해"
          onClick={() => setYear((value) => value - 1)}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium tabular-nums">{year}년</span>
        <button
          type="button"
          aria-label="다음 해"
          onClick={() => setYear((value) => value + 1)}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
          const selected = year === selectedYear && month === selectedMonth;
          return (
            <button
              key={month}
              type="button"
              onClick={() => onSelect(`${year}-${String(month).padStart(2, "0")}`)}
              className={cn(
                "rounded-md py-2 text-sm tabular-nums transition-colors",
                selected
                  ? "bg-brand font-medium text-brand-foreground"
                  : "hover:bg-muted",
              )}
            >
              {month}월
            </button>
          );
        })}
      </div>
    </div>
  );
}
