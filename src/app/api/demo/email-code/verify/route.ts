import { z } from "zod";

import { allow, clientIp } from "../../_lib/limit";
import { normalizeEmail, verify, type VerifyResult } from "../store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = z.object({ email: z.string().email(), code: z.string().min(4).max(10) });

const MESSAGE: Record<Exclude<VerifyResult, "ok">, string> = {
  "not-found": "발송된 인증코드가 없습니다. 다시 요청하세요.",
  expired: "인증코드가 만료되었습니다. 다시 요청하세요.",
  "too-many-attempts": "시도 횟수를 초과했습니다. 코드를 다시 요청하세요.",
  mismatch: "인증코드가 일치하지 않습니다.",
};

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  // 코드 자체에도 시도 제한이 있지만, 주소를 바꿔가며 긁는 것도 막는다
  if (!allow(`verify:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
    return Response.json({ error: "요청이 너무 잦습니다." }, { status: 429 });
  }

  const result = verify(normalizeEmail(parsed.data.email), parsed.data.code.trim());
  if (result === "ok") return Response.json({ verified: true });

  return Response.json({ verified: false, error: MESSAGE[result] }, { status: 400 });
}
