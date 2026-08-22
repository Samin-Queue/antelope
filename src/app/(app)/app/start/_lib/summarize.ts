import { generateObject, generateText } from "ai";
import { z } from "zod";

import { lanes } from "@/lib/ai/lanes";
import { env } from "@/lib/env";
import { parseDocument } from "@/lib/upstage";
import { findStep, runAgent, stepOutputs } from "@/lib/upstage-studio";

import type { IntakeFile } from "./fetch";
import type { Ctx, Intake } from "./intake";
import { bigModel, clip, smallModel } from "./llm";

/**
 * 2단계 — 요약과 판정.
 *
 * 파일은 유효성 검사(Studio: parse → analyze → summarize) 이 Markdown 으로 압축한다.
 * 페이지 본문과 사용자 문장은 Studio 를 못 타므로(파일이 아니다) Solar 가 같은
 * 섹션 구조로 직접 요약하고, 어느 경로였는지 `via` 에 남긴다 — 화면에 그대로 보인다.
 *
 * 판정은 보수적이다. 읽을 수 없거나 비었거나 본문을 못 가져온 것만 bad 다.
 * 그 외는 전부 good — "공고가 아닌 것 같다" 는 이유로 막지 않는다.
 */
export type SummaryPart = {
  name: string;
  markdown: string;
  via: string;
  /** 요약의 바탕이 된 원문 길이. 0 이면 본문을 못 읽은 것이다 */
  chars: number;
  error?: string;
};

export type Summary = { markdown: string; via: string; parts: SummaryPart[] };

const SECTIONS = "'# 문서 요약', '## 핵심 내용', '## 실행 정보', '## 확인 필요'";

export async function summarize(intake: Intake, ctx: Ctx): Promise<Summary> {
  /**
   * 나란히 돌린다.
   *
   * 파일·페이지·문장은 서로의 출력을 참조하지 않는데 직렬로 돌고 있었다.
   * Studio job 하나가 45~180초라 이건 단순히 느린 게 아니라 **런을 죽인다** —
   * `stage("summarize")` 는 240초에 잘리므로 파일 2~3개면 요약이 통째로
   * 실패하고 파이프라인이 「요약에 실패했습니다」로 끝난다.
   *
   * 상한은 레인이 건다. 무제한으로 풀면 상류 rate limit 과 컨테이너 메모리를
   * 동시에 건드린다. 순서는 `Promise.all` 이 보존한다.
   */
  const parts: SummaryPart[] = await Promise.all([
    ...intake.files.map((file) => lanes.studio(() => summarizeFile(file, ctx))),
    ...intake.pages.map(async (page): Promise<SummaryPart> => {
      const name = page.title || page.url;
      if (page.text.length < 20) {
        ctx.log(`페이지 본문이 비어 있음: ${name}`);
        return { name, markdown: "", via: "fetch", chars: page.text.length };
      }
      ctx.log(`페이지 요약 (Solar): ${name}`);
      return lanes.interactive(async () => ({
        name,
        markdown: await solarSummary(page.text, `웹페이지 「${name}」`),
        via: "solar",
        chars: page.text.length,
      }));
    }),
    ...(intake.sourceText && intake.sourceText.length >= 20
      ? [
          lanes.interactive(async (): Promise<SummaryPart> => {
            ctx.log("입력한 문장 요약 (Solar)");
            return {
              name: "입력한 내용",
              markdown: await solarSummary(intake.sourceText!, "사용자가 직접 쓴 설명"),
              via: "solar",
              chars: intake.sourceText!.length,
            };
          }),
        ]
      : []),
  ]);

  const usable = parts.filter((part) => part.markdown.trim());
  const markdown =
    usable.length <= 1
      ? (usable[0]?.markdown ?? "")
      : usable
          .map((part) => `> 출처: ${part.name}\n\n${part.markdown}`)
          .join("\n\n---\n\n");
  const via = [...new Set(parts.map((part) => part.via))].join(" + ") || "none";
  return { markdown, via, parts };
}

async function summarizeFile(file: IntakeFile, ctx: Ctx): Promise<SummaryPart> {
  const agentId = env.UPSTAGE_VALIDATION_AGENT_ID;
  if (agentId) {
    try {
      ctx.log(`유효성 검사 실행: ${file.name}`);
      const job = await runAgent({
        agentId,
        file: file.blob,
        filename: file.name,
        include: "all",
      });
      const outputs = stepOutputs(job);
      const summary = findStep(outputs, "summarize");
      const parse = findStep(outputs, "parse");
      const parsed = parse?.json as {
        content?: { markdown?: string; text?: string };
      } | null;
      const chars = (parsed?.content?.markdown ?? parsed?.content?.text ?? "").length;
      const markdown = summary ? unquote(summary.text) : "";
      if (markdown.startsWith("#")) {
        ctx.log(`유효성 검사 완료: ${outputs.map((o) => o.step).join(" → ")}`);
        return { name: file.name, markdown, via: "validation", chars };
      }
      ctx.log("유효성 검사 이 Markdown 을 만들지 못함 — Solar 로 대체");
    } catch (error) {
      ctx.log(`유효성 검사 실패 — Solar 로 대체: ${message(error)}`);
    }
  } else {
    ctx.log("UPSTAGE_VALIDATION_AGENT_ID 없음 — Document Parse + Solar 로 요약");
  }

  try {
    const parsed = await parseDocument(file.blob, { outputFormats: ["markdown"] });
    const text = parsed.content?.markdown ?? parsed.content?.text ?? "";
    if (text.trim().length < 20) {
      return { name: file.name, markdown: "", via: "document-parse", chars: text.length };
    }
    return {
      name: file.name,
      markdown: await solarSummary(text, `파일 「${file.name}」`),
      via: "document-parse + solar",
      chars: text.length,
    };
  } catch (error) {
    ctx.log(`파일을 읽지 못함: ${message(error)}`);
    return {
      name: file.name,
      markdown: "",
      via: "none",
      chars: 0,
      error: message(error),
    };
  }
}

/** 유효성 검사 과 같은 섹션 구조. 어느 경로로 왔든 다음 단계가 같은 모양을 받는다 */
async function solarSummary(text: string, what: string): Promise<string> {
  const { text: markdown } = await generateText({
    model: bigModel(),
    system: [
      "당신은 문서 요약 에이전트다. 주어진 원문만 근거로 문서의 목적, 핵심 사실, 요구·결정 사항,",
      "기한·금액·연락처 같은 실행 정보를 판단해 요약한다. 응답은 반드시 하나의 완결된",
      `Markdown 문서여야 한다. 인사말·설명·코드 펜스는 쓰지 않는다. ${SECTIONS} 섹션을`,
      "이 순서로 사용한다. 원문에 없는 정보는 추측하지 말고 '정보 없음' 또는 '원문 확인 필요'",
      "로 표기한다. 신청 방법·접수처·링크가 원문에 있으면 '## 실행 정보' 에 그대로 옮긴다.",
    ].join(" "),
    prompt: `${what}\n\n--- 원문 ---\n${clip(text)}`,
  });
  const trimmed = markdown.trim().replace(/^```(?:markdown)?\n?|\n?```$/g, "");
  return trimmed.startsWith("#") ? trimmed : `# 문서 요약\n\n${trimmed}`;
}

/** instruct 스텝은 JSON 문자열로 감싸 오기도 한다 */
function unquote(text: string): string {
  try {
    const decoded: unknown = JSON.parse(text);
    if (typeof decoded === "string") return decoded.trim();
  } catch {
    /* 평문 */
  }
  return text.trim();
}

const verdictSchema = z.object({
  verdict: z.enum(["good", "bad"]).nullish(),
  reason: z.string().nullish(),
});

export type Verdict = { verdict: "good" | "bad"; reason: string };

export async function judge(summary: Summary): Promise<Verdict> {
  const readable = summary.parts.filter(
    (part) => part.markdown.trim() && part.chars >= 20,
  );
  if (readable.length === 0) {
    const failed = summary.parts.find((part) => part.error);
    return {
      verdict: "bad",
      reason: failed
        ? `파일을 읽지 못했다: ${failed.error}`
        : "본문이 비어 있거나 텍스트를 가져오지 못했다.",
    };
  }

  try {
    const { object } = await generateObject({
      model: smallModel(),
      schema: verdictSchema,
      system: [
        "너는 문서 요약이 쓸 만한지 판정하는 보조자다. 결과를 아래 JSON 구조 그대로 낸다.",
        `{ "verdict": "good" | "bad", "reason": string }`,
        "",
        "bad 는 다음 경우뿐이다:",
        "- 요약이 비어 있거나 '정보 없음' 뿐이다",
        "- 내용을 이해할 수 없다 (깨진 글자, 무의미한 나열)",
        "- 원문을 읽지 못했다고 적혀 있다",
        "그 외에는 전부 good 이다. 공고가 아닌 것 같다는 이유로 bad 를 주지 않는다.",
        "reason 은 한 문장.",
      ].join("\n"),
      prompt: clip(summary.markdown, 12_000),
    });
    return {
      verdict: object.verdict ?? "good",
      reason: object.reason?.trim() || "읽을 수 있는 요약이다.",
    };
  } catch (error) {
    // 판정이 실패했다고 멈추지 않는다. 읽을 수 있는 요약이 있으면 good 이다.
    return {
      verdict: "good",
      reason: `판정 모델 실패, 요약이 있어 진행: ${message(error)}`,
    };
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
