import { parseDocument } from "@/lib/upstage";

export const maxDuration = 120;

/** multipart/form-data 로 file 하나를 받아 구조화된 문서로 되돌려준다. */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "file 필드가 필요합니다." }, { status: 400 });
  }

  const mode = form.get("mode");

  try {
    const parsed = await parseDocument(file, {
      model: mode === "enhanced" ? "document-parse-nightly" : "document-parse",
      mode: mode === "enhanced" ? "enhanced" : undefined,
    });

    return Response.json({
      name: file.name,
      pages: parsed.usage?.pages ?? null,
      markdown: parsed.content?.markdown ?? null,
      html: parsed.content?.html ?? null,
      elements: parsed.elements?.length ?? 0,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
