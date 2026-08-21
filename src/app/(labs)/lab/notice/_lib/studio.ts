import { env } from "@/lib/env";
import { findStep, runAgent, stepOutputs, type JobStatus } from "@/lib/upstage-studio";

import { isCategory } from "./categories";
import { normalize, type Notice } from "./schema";

/**
 * Studio 파이프라인으로 파일을 처리한다.
 *
 * 트랙 요건이 "Studio must power the core document-processing stages" 라
 * 파일 입력은 이 경로가 기본이다. Agent ID 가 없으면 호출부가 v1 로 떨어진다.
 *
 * Config: parse → classify(split) → extract-{contract|housing|job|general} → gaps
 */
export type StudioResult = {
  notice: Notice;
  /** 어느 분기를 탔는지. 화면에 그대로 보여준다 */
  steps: string[];
  /** 원문 인용 좌표. 근거 하이라이트의 재료 */
  citations: unknown;
  /** parse 단계의 마크다운. 이후 단계가 쓸 수 있다 */
  markdown: string | null;
};

export function hasStudioAgent(): boolean {
  return Boolean(env.UPSTAGE_AGENT_ID);
}

/** instruct 는 마크다운 목록으로 답한다. 한 줄씩 끊어 unknowns 로 만든다. */
function parseGaps(text: string): string[] {
  return text
    .replace(/^"|"$/g, "")
    .split(/\\n|\n/)
    .map((line) =>
      line
        .replace(/^[-*·]\s*/, "")
        .replace(/【[^】]*】/g, "")
        .trim(),
    )
    .filter((line) => line.length > 2 && !line.startsWith("#") && !line.includes("**"))
    .slice(0, 8);
}

export async function runStudio(
  file: File | Blob,
  filename: string,
  onStatus?: (status: JobStatus) => void,
): Promise<StudioResult> {
  const agentId = env.UPSTAGE_AGENT_ID;
  if (!agentId) throw new Error("UPSTAGE_AGENT_ID 미설정");

  const job = await runAgent({ agentId, file, filename, include: "all", onStatus });
  const outputs = stepOutputs(job);

  const parse = findStep(outputs, "parse");
  const classify = findStep(outputs, "classify");
  const extract = findStep(outputs, "extract");
  const gaps = findStep(outputs, "gaps");

  if (!extract?.json) {
    throw new Error("Studio 추출 결과가 비어 있습니다.");
  }

  const raw = extract.json as Record<string, unknown>;
  // classify 결과는 평문 라벨로 온다.
  const category = classify?.text.trim().replace(/^"|"$/g, "");

  const notice = normalize(
    {
      ...raw,
      category: isCategory(category) ? category : undefined,
      unknowns: gaps ? parseGaps(gaps.text) : undefined,
      // 정식 문서를 Studio 로 돌린 것이므로 신뢰도가 높다.
      confidence: "high",
    } as never,
    filename,
  );

  const parsed = parse?.json as { content?: { markdown?: string } } | null;

  return {
    notice,
    steps: outputs.map((item) => item.step),
    citations: gaps?.citations ?? null,
    markdown: parsed?.content?.markdown ?? null,
  };
}
