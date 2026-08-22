import { stepOutputs, uploadFile, waitForJob } from "@/lib/upstage-studio";

export const maxDuration = 240;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const agentId = process.env.UPSTAGE_MICHAEL_AGENT_ID;
  // uploadFile 은 Studio 키로 올리는데(upstage-studio.ts) 여기서 v1 키로 job 을
  // 만들면 계정이 갈려 403 이 난다. 같은 키를 쓴다.
  const apiKey = process.env.UPSTAGE_STUDIO_API_KEY || process.env.UPSTAGE_API_KEY;
  if (!agentId || !apiKey) {
    return Response.json({ error: "Michael Studio 설정이 없습니다." }, { status: 503 });
  }

  const files = (await req.formData())
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    return Response.json(
      { error: "공고를 포함한 문서를 하나 이상 선택하세요." },
      { status: 400 },
    );
  }
  if (files.some((file) => file.size > MAX_BYTES)) {
    return Response.json({ error: "각 문서는 25MB 이하여야 합니다." }, { status: 413 });
  }

  try {
    const uploaded = await Promise.all(files.map((file) => uploadFile(file, file.name)));
    const response = await fetch("https://api.upstage.ai/v2/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: agentId,
        input: [
          {
            role: "user",
            content: uploaded.map((file) => ({ type: "input_file", file_id: file.id })),
          },
        ],
      }),
    });
    if (!response.ok)
      throw new Error(`Studio ${response.status}: ${await response.text()}`);

    const created: unknown = await response.json();
    if (
      !created ||
      typeof created !== "object" ||
      !("id" in created) ||
      typeof created.id !== "string"
    ) {
      throw new Error("Studio가 Job ID를 반환하지 않았습니다.");
    }

    const job = await waitForJob(created.id, { include: "all" });
    const output = stepOutputs(job).find((item) => item.step.startsWith("extract-"));
    if (!output?.json) throw new Error("Michael이 JSON 필드 목록을 만들지 못했습니다.");

    return Response.json({
      files: files.map((file) => file.name),
      json: output.json,
      step: output.step,
    });
  } catch (error: unknown) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Michael 실행에 실패했습니다." },
      { status: 502 },
    );
  }
}
