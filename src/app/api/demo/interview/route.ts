import { createHash } from "node:crypto";
import { z } from "zod";

import { env } from "@/lib/env";

import { allow, clientIp } from "../_lib/limit";
import {
  allowedRecipient,
  mailConfigured,
  sendInterviewInvite,
  type Interview,
} from "../_lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(40),
  position: z.string().min(1).max(80),
  receipt: z.string().min(1).max(60),
});

const SLOTS = ["10:00", "11:00", "14:00", "15:00", "16:00"] as const;
const PLACES = [
  "본사 3층 회의실 A (경상북도 포항시 남구 가상로 12)",
  "본사 3층 회의실 B (경상북도 포항시 남구 가상로 12)",
  "온라인 (Google Meet · 링크는 면접 전일 발송)",
] as const;
const INTERVIEWERS = [
  "김서버 백엔드 리드, 박정산 시니어 엔지니어",
  "박정산 시니어 엔지니어, 이플랫폼 테크리드",
  "김서버 백엔드 리드, 최인사 인사팀장",
] as const;

/**
 * 접수번호에서 면접 일정을 정한다.
 *
 * 난수를 쓰지 않는 이유 — 같은 접수번호로 다시 부르면 같은 일정이 나와야
 * 재현 가능한 데모가 된다. 메일을 두 번 받아도 내용이 흔들리지 않는다.
 */
function scheduleFor(receipt: string): Interview {
  const seed = parseInt(
    createHash("sha256").update(receipt).digest("hex").slice(0, 8),
    16,
  );

  // 최소 7일 뒤부터, 영업일로만 세어 0~4일 더 민다.
  // 달력일로 밀고 나서 주말을 보정하면 대부분이 같은 월요일로 몰린다.
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 7);
  while (isWeekend(date)) date.setUTCDate(date.getUTCDate() + 1);
  for (let step = seed % 5; step > 0;) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (!isWeekend(date)) step--;
  }

  const time = SLOTS[seed % SLOTS.length];
  const [hour, minute] = time.split(":").map(Number);
  const endHour = hour + 1;
  const endTime = `${String(endHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const iso = date.toISOString().slice(0, 10);
  // KST 기준 시각이라 UTC 로는 9시간을 뺀다
  const startUtc = toUtcStamp(iso, hour - 9, minute);
  const endUtc = toUtcStamp(iso, endHour - 9, minute);

  return {
    date: iso,
    time,
    endTime,
    place: PLACES[seed % PLACES.length],
    interviewer: INTERVIEWERS[seed % INTERVIEWERS.length],
    startUtc,
    endUtc,
  };
}

function isWeekend(d: Date) {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function toUtcStamp(isoDate: string, hour: number, minute: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCHours(hour, minute, 0, 0);
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const { name, position, receipt } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  if (!allow(`interview-ip:${clientIp(req)}`, 5, 10 * 60 * 1000)) {
    return Response.json(
      { error: "요청이 너무 잦습니다. 10분 후 다시 시도하세요." },
      { status: 429 },
    );
  }
  if (!allow(`interview-mail:${email}`, 3, 10 * 60 * 1000)) {
    return Response.json(
      { error: "이 주소로는 잠시 후 다시 요청할 수 있습니다." },
      { status: 429 },
    );
  }
  if (!allowedRecipient(email)) {
    return Response.json(
      { error: "이 주소로는 발송할 수 없도록 설정되어 있습니다." },
      { status: 403 },
    );
  }

  const interview = scheduleFor(receipt);

  if (!mailConfigured()) {
    // 접수 자체는 성공한 것으로 둔다. 메일만 못 보냈다는 사실을 분명히 돌려준다.
    if (env.NODE_ENV === "production") {
      return Response.json(
        { sent: false, interview, reason: "smtp-missing" },
        { status: 200 },
      );
    }
    return Response.json({ sent: false, interview, reason: "smtp-missing" });
  }

  try {
    await sendInterviewInvite({ to: email, name, position, receipt, interview });
  } catch (error) {
    console.error("[demo/interview] 발송 실패", error);
    return Response.json(
      { sent: false, interview, reason: "send-failed" },
      { status: 200 },
    );
  }

  return Response.json({ sent: true, interview });
}
