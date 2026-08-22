import { runAgent, stepOutputs } from "@/lib/upstage-studio";

export const maxDuration = 240;

const MAX_BYTES = 25 * 1024 * 1024;

function markdownFromOutput(text: string): string {
  try {
    const decoded: unknown = JSON.parse(text);
    if (typeof decoded === "string") return decoded.trim();
  } catch {
    return text.trim();
  }
  return text.trim();
}

export async function POST(req: Request) {
  const agentId = process.env.UPSTAGE_VALIDATION_AGENT_ID;
  if (!agentId) {
    return Response.json(
      { error: "UPSTAGE_VALIDATION_AGENT_ID가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "요약할 문서를 선택하세요." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "문서는 25MB 이하여야 합니다." }, { status: 413 });
  }

  try {
    const job = await runAgent({ agentId, file, filename: file.name, include: "all" });
    const outputs = stepOutputs(job);
    const summary = outputs.find((output) => output.step === "summarize");
    const markdown = summary ? markdownFromOutput(summary.text) : "";

    if (!markdown.startsWith("#")) {
      return Response.json(
        { error: "유효성 검사 에이전트가 Markdown 요약을 만들지 못했습니다." },
        { status: 502 },
      );
    }

    return Response.json({
      filename: file.name,
      markdown,
      steps: outputs.map((output) => output.step),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "유효성 검사 실행에 실패했습니다.";
    return Response.json({ error: message }, { status: 502 });
  }
}
