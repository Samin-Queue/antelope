import { monthEvents } from "@/lib/google-calendar";
import { currentSession } from "@/lib/session";
import { AppHeader } from "@/components/app/app-header";

import { listGoals } from "../_lib/goals";
import { CalendarBoard, type Deadline } from "./_lib/board";
import { gridRange, monthOf, parseMonth, ymdOf } from "./_lib/month";

export const dynamic = "force-dynamic";
export const metadata = { title: "캘린더" };

/**
 * 마감이 달력 위에 놓이는 자리.
 *
 * 「언제까지인가」는 목록보다 달력에서 훨씬 빨리 읽힌다. 구글 캘린더를
 * 연동했으면 그날 이미 잡힌 일정을 배경으로 깔아 준비할 시간이 있는지까지 본다.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await currentSession();

  const now = new Date();
  const today = ymdOf(now);
  const month = parseMonth((await searchParams).month) ?? monthOf(now);
  const { from, to } = gridRange(month);

  const goals = session ? await listGoals(session.user.id) : [];
  const deadlines: Deadline[] = goals
    .filter((goal) => goal.deadline)
    // 마감이 `2026-09-15T18:00` 로 저장되기도 한다. 날짜 부분만 쓴다.
    .map((goal) => ({
      id: goal.id,
      title: goal.title,
      organization: goal.organization,
      date: goal.deadline!.slice(0, 10),
      closed: goal.stage === "closed",
    }))
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date));

  const { connected, events, holidays } = session
    ? await monthEvents(from, to)
    : { connected: false, events: [], holidays: {} };

  return (
    <>
      <AppHeader trail={["캘린더"]} />
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <CalendarBoard
          month={month}
          today={today}
          deadlines={deadlines}
          events={events}
          holidays={holidays}
          connected={connected}
        />
      </div>
    </>
  );
}
