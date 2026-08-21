import { z } from "zod";

import { env } from "@/lib/env";

import { allow, clientIp } from "../_lib/limit";
import { allowedRecipient, mailConfigured, sendVerificationCode } from "../_lib/mailer";
import { issue, normalizeEmail } from "./store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "이메일 주소가 올바르지 않습니다." }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);

  // 인증 없는 공개 엔드포인트다. 두 축으로 막는다 — 발신 IP 와 수신 주소.
  if (!allow(`ip:${clientIp(req)}`, 5, 10 * 60 * 1000)) {
    return Response.json(
      { error: "요청이 너무 잦습니다. 10분 후 다시 시도하세요." },
      { status: 429 },
    );
  }
  if (!allow(`mail:${email}`, 3, 10 * 60 * 1000)) {
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

  const { code, expiresInMinutes } = issue(email);

  if (!mailConfigured()) {
    // SMTP 미설정. 개발 환경에서는 흐름이 끊기지 않도록 코드를 돌려주되,
    // 그 사실을 응답에 명시한다. 프로덕션에서는 조용히 통과시키지 않는다.
    if (env.NODE_ENV === "production") {
      return Response.json(
        { error: "메일 발송이 설정되지 않았습니다. SMTP_* 환경변수를 확인하세요." },
        { status: 503 },
      );
    }
    return Response.json({ sent: false, devCode: code, expiresInMinutes });
  }

  try {
    await sendVerificationCode(email, code, expiresInMinutes);
  } catch (error) {
    console.error("[demo/email-code] 발송 실패", error);
    return Response.json(
      { error: "메일 발송에 실패했습니다. 주소를 확인하고 다시 시도하세요." },
      { status: 502 },
    );
  }

  // 코드는 응답에 싣지 않는다. 메일을 열어야만 알 수 있어야 한다.
  return Response.json({ sent: true, expiresInMinutes });
}
