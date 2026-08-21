import nodemailer, { type Transporter } from "nodemailer";

import { env } from "@/lib/env";

/**
 * 데모 사이트용 SMTP 발송.
 *
 * 도메인이 없어 Resend 는 못 쓴다(가입 계정 본인 주소로만 수신).
 * Gmail·네이버 앱 비밀번호를 쓰면 도메인 없이 임의 주소로 실제 발송된다.
 */

export function mailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
}

let cached: Transporter | null = null;

function transport() {
  if (cached) return cached;
  const port = env.SMTP_PORT ?? 465;
  cached = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    // 465 는 처음부터 TLS, 587 은 STARTTLS 로 승격한다
    secure: port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return cached;
}

/** 비어 있으면 제한 없음. 주소 전체 또는 `@도메인` 형태를 받는다. */
export function allowedRecipient(email: string) {
  const raw = env.DEMO_MAIL_ALLOWLIST?.trim();
  if (!raw) return true;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => (rule.startsWith("@") ? email.endsWith(rule) : email === rule));
}

const DISCLAIMER =
  "이 메일은 문서 에이전트 검증용으로 만든 가상의 사이트에서 발송되었습니다. 실제 기관·기업과 무관합니다.";

type Attachment = { filename: string; content: string; contentType: string };

async function send(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Attachment[];
}) {
  await transport().sendMail({
    ...opts,
    from: `"${opts.from}" <${env.SMTP_USER}>`,
  });
}

/* ------------------------------------------------------------------ */
/* 장학재단 — 회원가입 인증코드                                          */
/* ------------------------------------------------------------------ */

export async function sendVerificationCode(
  to: string,
  code: string,
  expiresInMinutes: number,
) {
  const from = env.SMTP_FROM_NAME ?? "미래희망장학재단";
  await send({
    from,
    to,
    subject: `[${from}] 이메일 인증코드 ${code}`,
    text: [
      `${from} 회원가입 인증코드입니다.`,
      "",
      `인증코드: ${code}`,
      `유효시간: ${expiresInMinutes}분`,
      "",
      "본인이 요청하지 않았다면 이 메일을 무시하세요.",
      "",
      `— ${DISCLAIMER}`,
    ].join("\n"),
    html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#171717">
  <p style="margin:0;font-size:13px;font-weight:600;color:#a3123f">${from}</p>
  <h1 style="margin:8px 0 24px;font-size:20px;font-weight:700">이메일 인증코드</h1>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#404040">
    아래 코드를 입력하면 회원가입이 완료됩니다.
  </p>
  <div style="background:#fcecf1;border-radius:8px;padding:20px;text-align:center">
    <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#a3123f">${code}</span>
  </div>
  <p style="margin:16px 0 0;font-size:13px;color:#737373">
    유효시간 ${expiresInMinutes}분. 본인이 요청하지 않았다면 이 메일을 무시하세요.
  </p>
  <hr style="margin:28px 0 16px;border:0;border-top:1px solid #e5e5e5">
  <p style="margin:0;font-size:12px;line-height:1.6;color:#a3a3a3">${DISCLAIMER}</p>
</div>`.trim(),
  });
}

/* ------------------------------------------------------------------ */
/* 다온소프트 — 서류 접수 확인 + 1차 면접 일정                           */
/* ------------------------------------------------------------------ */

export type Interview = {
  /** 2026-09-14 */
  date: string;
  /** 14:00 */
  time: string;
  /** 종료 시각 */
  endTime: string;
  place: string;
  interviewer: string;
  /** ICS 용 UTC 타임스탬프 */
  startUtc: string;
  endUtc: string;
};

export async function sendInterviewInvite(opts: {
  to: string;
  name: string;
  position: string;
  receipt: string;
  interview: Interview;
}) {
  const { to, name, position, receipt, interview } = opts;
  const from = "주식회사 다온소프트 인사팀";
  const when = `${interview.date} ${interview.time}~${interview.endTime}`;

  const prep = [
    "신분증 (본인 확인용)",
    "노트북 — 코드 리뷰 세션에서 사용합니다",
    "제출하신 포트폴리오 중 직접 설명하고 싶은 항목 1개",
  ];

  await send({
    from,
    to,
    subject: `[다온소프트] ${name}님 1차 면접 일정 안내 (${interview.date} ${interview.time})`,
    text: [
      `${name}님, 안녕하세요. 주식회사 다온소프트 인사팀입니다.`,
      "",
      `${position} 포지션에 지원해 주셔서 감사합니다. 제출하신 서류가 정상 접수되어`,
      "1차 면접 일정을 아래와 같이 안내드립니다.",
      "",
      `접수번호: ${receipt}`,
      `일시: ${when}`,
      `장소: ${interview.place}`,
      `면접관: ${interview.interviewer}`,
      "",
      "준비물",
      ...prep.map((p) => `  - ${p}`),
      "",
      "일정 변경이 필요하시면 이 메일에 회신해 주세요. 면접 3일 전까지 1회에 한해",
      "조정 가능합니다.",
      "",
      `— ${DISCLAIMER}`,
    ].join("\n"),
    html: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#171717">
  <p style="margin:0;font-size:13px;font-weight:600;color:#0f6f5c">주식회사 다온소프트</p>
  <h1 style="margin:8px 0 4px;font-size:20px;font-weight:700">1차 면접 일정 안내</h1>
  <p style="margin:0 0 24px;font-size:13px;color:#737373">접수번호 ${receipt}</p>

  <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#404040">
    <strong>${name}</strong>님, ${position} 포지션에 지원해 주셔서 감사합니다.<br>
    제출하신 서류가 정상 접수되어 1차 면접 일정을 안내드립니다.
  </p>

  <table style="width:100%;border-collapse:collapse;background:#eaf5f2;border-radius:8px">
    <tr>
      <td style="padding:14px 16px 6px;font-size:12px;color:#0f6f5c">일시</td>
      <td style="padding:14px 16px 6px;font-size:14px;font-weight:700">${when}</td>
    </tr>
    <tr>
      <td style="padding:6px 16px;font-size:12px;color:#0f6f5c">장소</td>
      <td style="padding:6px 16px;font-size:14px">${interview.place}</td>
    </tr>
    <tr>
      <td style="padding:6px 16px 14px;font-size:12px;color:#0f6f5c">면접관</td>
      <td style="padding:6px 16px 14px;font-size:14px">${interview.interviewer}</td>
    </tr>
  </table>

  <h2 style="margin:28px 0 8px;font-size:14px;font-weight:700">준비물</h2>
  <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.9;color:#404040">
    ${prep.map((p) => `<li>${p}</li>`).join("\n    ")}
  </ul>

  <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#404040">
    일정 변경이 필요하시면 이 메일에 회신해 주세요.
    면접 3일 전까지 <strong>1회에 한해</strong> 조정 가능합니다.
  </p>
  <p style="margin:12px 0 0;font-size:12px;color:#737373">
    첨부된 초대장(.ics)을 열면 캘린더에 바로 등록됩니다.
  </p>

  <hr style="margin:28px 0 16px;border:0;border-top:1px solid #e5e5e5">
  <p style="margin:0;font-size:12px;line-height:1.6;color:#a3a3a3">${DISCLAIMER}</p>
</div>`.trim(),
    attachments: [
      {
        filename: "면접일정.ics",
        contentType: "text/calendar; charset=utf-8; method=REQUEST",
        content: buildIcs({ receipt, name, position, interview }),
      },
    ],
  });
}

/** 최소한의 VCALENDAR. 줄바꿈은 반드시 CRLF 여야 캘린더 앱이 읽는다. */
function buildIcs(opts: {
  receipt: string;
  name: string;
  position: string;
  interview: Interview;
}) {
  const { receipt, name, position, interview } = opts;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Daon Soft//Hiring Demo//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${receipt}@demo.daonsoft.invalid`,
    `DTSTAMP:${interview.startUtc}`,
    `DTSTART:${interview.startUtc}`,
    `DTEND:${interview.endUtc}`,
    `SUMMARY:[다온소프트] ${position} 1차 면접 - ${name}`,
    `LOCATION:${interview.place}`,
    `DESCRIPTION:접수번호 ${receipt} / 면접관 ${interview.interviewer}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
