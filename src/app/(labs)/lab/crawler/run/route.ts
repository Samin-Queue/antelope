import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { crawlOpportunities } from "../../../../../../scripts/crawl-opportunities";

export const runtime = "nodejs";

const requestSchema = z.object({ password: z.string().min(1) });

function hasValidPassword(password: string, expected: string): boolean {
  const input = Buffer.from(password);
  const secret = Buffer.from(expected);
  return input.length === secret.length && timingSafeEqual(input, secret);
}

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.CRAWL_PASSWORD;
  if (!expected) {
    return Response.json(
      { error: "CRAWL_PASSWORD가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const body = requestSchema.safeParse(await request.json().catch(() => undefined));
  if (!body.success || !hasValidPassword(body.data.password, expected)) {
    return Response.json({ error: "인증에 실패했습니다." }, { status: 401 });
  }

  await crawlOpportunities();
  return Response.json({ ok: true });
}
