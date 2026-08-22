"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/month-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { monthLabel, shiftMonth } from "./month";

/**
 * 월 전환.
 *
 * 제목이 곧 버튼이다 — 지금 보고 있는 달을 읽는 자리와 다른 달로 가는 자리가
 * 같아야 눈이 한 번만 움직인다. 옆의 ◀▶ 는 붙은 달, 팝오버는 먼 달을 위한 것이다.
 * 선택은 URL 로 남아 새로고침·뒤로가기가 그대로 동작한다.
 */
export function MonthNav({ month }: { month: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button variant="ghost" className="gap-1.5 px-2 text-lg font-medium">
              {monthLabel(month)}
              <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <MonthPicker
            value={month}
            onSelect={(next) => {
              setOpen(false);
              router.push(`/app/calendar?month=${next}`);
            }}
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="이전 달"
        render={<Link href={`/app/calendar?month=${shiftMonth(month, -1)}`} />}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="다음 달"
        render={<Link href={`/app/calendar?month=${shiftMonth(month, 1)}`} />}
      >
        <ChevronRight />
      </Button>

      {/* 몇 달 넘긴 뒤 돌아올 길. 선택한 날짜도 오늘로 되돌린다 */}
      <Button
        variant="ghost"
        size="xs"
        className="ml-auto"
        render={<Link href="/app/calendar" />}
      >
        오늘
      </Button>
    </div>
  );
}
