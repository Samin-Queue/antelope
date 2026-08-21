import { deriveFields } from "../_lib/agents";
import type { Notice } from "../_lib/schema";

export const maxDuration = 120;

/** 공고에서 「이 공고에 필요한 질문」만 도출한다. */
export async function POST(req: Request) {
  const body = (await req.json()) as { notice?: Notice };
  if (!body.notice) {
    return Response.json({ error: "notice 가 필요합니다." }, { status: 400 });
  }
  try {
    const fields = await deriveFields(body.notice);
    return Response.json({ fields });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
