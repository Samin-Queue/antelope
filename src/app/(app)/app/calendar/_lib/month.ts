/**
 * 월 그리드 계산.
 *
 * 캘린더 라이브러리를 넣지 않는다 — 월간 보드는 6×7 셀을 채우는 일이라
 * 날짜 산술 몇 줄이면 되고, 라이브러리를 쓰면 셀 안에 무엇을 그릴지가
 * 그쪽 API 에 묶인다. 우리는 셀 안에 마감·일정을 같이 얹어야 한다.
 *
 * ⚠ 런타임 의존성이 없다. 클라이언트 컴포넌트가 그대로 import 한다.
 */
export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const pad = (value: number) => String(value).padStart(2, "0");

/** 'YYYY-MM' 이 아니면 null. 쿼리스트링을 그대로 믿지 않는다. */
export function parseMonth(value: string | undefined): string | null {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}

export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function ymdOf(date: Date): string {
  return `${monthOf(date)}-${pad(date.getDate())}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, index - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`;
}

export function monthLabel(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return `${year}년 ${index}월`;
}

export type Cell = { ymd: string; inMonth: boolean; weekday: number };

/**
 * 일요일 시작 6주 고정 그리드. 앞뒤 달 날짜로 채워 셀 수가 달마다 흔들리지
 * 않게 한다 — 월을 넘길 때 표가 늘었다 줄면 눈이 따라가지 못한다.
 */
export function monthGrid(month: string): Cell[] {
  const [year, index] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, index - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());

  return Array.from({ length: 42 }, (_, offset) => {
    const at = new Date(start);
    at.setUTCDate(start.getUTCDate() + offset);
    const ymd = `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
    return { ymd, inMonth: ymd.startsWith(month), weekday: at.getUTCDay() };
  });
}

/** 그리드가 실제로 덮는 범위. 구글 캘린더를 이 폭으로 조회한다. */
export function gridRange(month: string): { from: string; to: string } {
  const cells = monthGrid(month);
  return { from: cells[0].ymd, to: cells[cells.length - 1].ymd };
}

/** 오늘 기준 남은 날. 음수면 지난 것이다. */
export function daysUntil(ymd: string, todayYmd: string): number {
  const at = Date.parse(`${ymd}T00:00:00Z`);
  const today = Date.parse(`${todayYmd}T00:00:00Z`);
  return Math.round((at - today) / 86_400_000);
}
