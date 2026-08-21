import { extractInformation } from "@/lib/upstage";

export const maxDuration = 120;

/**
 * 문서에서 임의 JSON 스키마로 필드를 뽑는다.
 * 트랙이 정해지면 schema 만 바꿔 끼우면 되는 지점이다.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const rawSchema = form.get("schema");

  if (!(file instanceof File)) {
    return Response.json({ error: "file 필드가 필요합니다." }, { status: 400 });
  }
  if (typeof rawSchema !== "string" || rawSchema.trim() === "") {
    return Response.json({ error: "schema 필드가 필요합니다." }, { status: 400 });
  }

  let parsedSchema: Record<string, unknown>;
  try {
    parsedSchema = JSON.parse(rawSchema);
  } catch {
    return Response.json(
      { error: "schema 가 올바른 JSON 이 아닙니다." },
      { status: 400 },
    );
  }

  try {
    const result = await extractInformation(file, parsedSchema);
    return Response.json({ name: file.name, result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
