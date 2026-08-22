import { googleAccessToken } from "@/lib/google";
import { GOOGLE_SCOPES } from "@/lib/google-scopes";

/**
 * 구글 캘린더 읽기.
 *
 * `calendarList.list` 로 사용자가 실제로 보고 있는 캘린더를 모으고, 각 캘린더의
 * `events.list` 를 합친다. 기본 캘린더만 읽으면 공휴일·팀 캘린더가 통째로 빠져
 * 「내 구글 캘린더와 다르다」가 된다.
 *
 * 스코프가 아직 없으면 토큰이 null 이라 그대로 빈 결과다 — 없는 권한으로
 * API 를 때려 403 을 받지 않는다.
 */
export type CalendarEvent = {
  id: string;
  title: string;
  /** YYYY-MM-DD. 종일이면 시작일, 시간 일정이면 시작 시각의 날짜 */
  date: string;
  /** HH:mm. 종일 일정은 null */
  time: string | null;
  allDay: boolean;
  calendar: string;
  url: string | null;
};

/**
 * 구글의 공휴일 캘린더 id 는 `..#holiday@group.v.calendar.google.com` 로 끝난다.
 * 한국 공휴일은 `ko.south_korea#holiday@...` 다.
 *
 * 공휴일을 일반 일정과 섞지 않는 이유: 달력에서 「쉬는 날」은 배경 정보라
 * 날짜 색으로 충분하고, 일정 줄은 지원 기간처럼 실제로 읽어야 하는 것에 준다.
 * 그리고 이걸 구글에서 받으면 `date-holidays` 가 못 잡는 대체공휴일까지 맞는다.
 */
function isHolidayCalendar(id: string): boolean {
  return id.includes("#holiday@group.v.calendar.google.com");
}

type ApiEvent = {
  id?: string;
  summary?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
};

const API = "https://www.googleapis.com/calendar/v3";

async function get<T>(token: string, path: string): Promise<T | null> {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

/** 월 그리드가 6주를 그리므로 앞뒤로 넉넉히 잡아 넘겨받는다. */
export async function monthEvents(
  fromYmd: string,
  toYmd: string,
): Promise<{
  connected: boolean;
  events: CalendarEvent[];
  /** YYYY-MM-DD → 공휴일명 */
  holidays: Record<string, string>;
}> {
  const token = await googleAccessToken(GOOGLE_SCOPES.calendar);
  if (!token) return { connected: false, events: [], holidays: {} };

  const list = await get<{
    items?: Array<{ id: string; summary?: string; selected?: boolean }>;
  }>(token, "/users/me/calendarList?minAccessRole=reader");
  const calendars = (list?.items ?? []).filter((item) => item.selected !== false);

  const timeMin = `${fromYmd}T00:00:00Z`;
  const timeMax = `${toYmd}T23:59:59Z`;

  const perCalendar = await Promise.all(
    calendars.map(
      async (calendar): Promise<{ holiday: boolean; items: CalendarEvent[] }> => {
        const query = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "250",
        });
        const page = await get<{ items?: ApiEvent[] }>(
          token,
          `/calendars/${encodeURIComponent(calendar.id)}/events?${query}`,
        );
        return {
          holiday: isHolidayCalendar(calendar.id),
          items: (page?.items ?? [])
            .map((event) => toEvent(event, calendar.summary ?? ""))
            .filter((event): event is CalendarEvent => event !== null),
        };
      },
    ),
  );

  const holidays: Record<string, string> = {};
  for (const group of perCalendar) {
    if (!group.holiday) continue;
    for (const item of group.items) holidays[item.date] ??= item.title;
  }

  return {
    connected: true,
    events: perCalendar.filter((group) => !group.holiday).flatMap((group) => group.items),
    holidays,
  };
}

function toEvent(event: ApiEvent, calendar: string): CalendarEvent | null {
  const allDay = Boolean(event.start?.date);
  const raw = event.start?.date ?? event.start?.dateTime;
  if (!raw) return null;

  // 시간 일정은 사용자의 로컬 시각으로 읽혀야 한다. dateTime 에 오프셋이
  // 들어 있으므로 Date 로 한 번 통과시킨다. 종일 일정은 그대로 날짜다.
  if (allDay) {
    return {
      id: event.id ?? raw,
      title: event.summary ?? "(제목 없음)",
      date: raw,
      time: null,
      allDay: true,
      calendar,
      url: event.htmlLink ?? null,
    };
  }

  const at = new Date(raw);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    id: event.id ?? raw,
    title: event.summary ?? "(제목 없음)",
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
    allDay: false,
    calendar,
    url: event.htmlLink ?? null,
  };
}
