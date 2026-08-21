import { getDb, hasDb, schema } from "@/lib/db";
import { parseDocument } from "@/lib/upstage";

export const maxDuration = 120;

/** 25MB — Upstage 동기 파싱 한도 안쪽으로 잡는다. */
const MAX_BYTES = 25 * 1024 * 1024;

export type ParseResponse = {
  id: string | null;
  name: string;
  bytes: number;
  pages: number | null;
  markdown: string | null;
  html: string | null;
  elements: Array<{ page: number | null; category: string | null }>;
};

/** multipart/form-data 로 file 하나를 받아 구조화된 문서로 되돌려준다. */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "file 필드가 필요합니다." }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "빈 파일입니다." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      {
        error: `파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB / 최대 25MB)`,
      },
      { status: 413 },
    );
  }

  const enhanced = form.get("mode") === "enhanced";

  try {
    const parsed = await parseDocument(file, {
      // enhanced 모드는 표·차트가 많은 문서에서 정확도가 올라가지만 nightly 모델을 쓴다.
      model: enhanced ? "document-parse-nightly" : "document-parse",
      mode: enhanced ? "enhanced" : undefined,
    });

    const markdown = parsed.content?.markdown ?? null;
    const html = parsed.content?.html ?? null;

    // DB 가 붙어 있을 때만 저장한다. 없어도 파싱 결과는 그대로 돌려준다.
    let id: string | null = null;
    if (hasDb()) {
      const [row] = await getDb()
        .insert(schema.documents)
        .values({
          title: file.name,
          raw: parsed as unknown as Record<string, unknown>,
          content: markdown ?? html,
        })
        .returning({ id: schema.documents.id });
      id = row?.id ?? null;
    }

    const body: ParseResponse = {
      id,
      name: file.name,
      bytes: file.size,
      pages: parsed.usage?.pages ?? null,
      markdown,
      html,
      elements: (parsed.elements ?? []).map((element) => ({
        page: element.page ?? null,
        category: element.category ?? null,
      })),
    };

    return Response.json(body);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
