import { runAgent, stepOutputs } from "@/lib/upstage-studio";

export const maxDuration = 240;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const agentId = process.env.UPSTAGE_ANALYSIS_AGENT_ID;
  if (!agentId) {
    return Response.json({ error: "정보 분석 Studio 설정이 없습니다." }, { status: 503 });
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
    // ⚠ 예전에는 여기서 `fetch` 로 job 을 직접 만들었다. 그 안에 키 해석 규칙
    // (Studio 전용 키 → v1 키)이 복제돼 있었고, 어긋나면 파일과 에이전트가
    // 다른 계정에 있게 돼 `403 No access to file` 이 난다 — 증상이 파일 쪽
    // 오류로 나와 원인을 엉뚱한 데서 찾게 되는 그 값이다. 규칙은 한 곳에만 둔다.
    const job = await runAgent({
      agentId,
      files: files.map((file) => ({ blob: file, name: file.name })),
      include: "all",
    });
    const output = stepOutputs(job).find((item) => item.step.startsWith("extract-"));
    if (!output?.json)
      throw new Error("정보 분석 에이전트가 JSON 필드 목록을 만들지 못했습니다.");

    return Response.json({
      files: files.map((file) => file.name),
      json: output.json,
      step: output.step,
    });
  } catch (error: unknown) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "정보 분석 실행에 실패했습니다.",
      },
      { status: 502 },
    );
  }
}
