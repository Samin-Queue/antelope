import { z } from "zod";

import { isAbort, runObject, runText } from "@/lib/ai/gateway";
import { lanes } from "@/lib/ai/lanes";
import { env } from "@/lib/env";
import { parseDocument } from "@/lib/upstage";
import { findStep, runAgent, stepOutputs, uploadFile } from "@/lib/upstage-studio";

import type { Discovery } from "./discover";
import type { IntakeFile } from "./fetch";
import type { Ctx, Intake } from "./intake";
import { clip } from "./llm";

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
  /**
   * 이 요약의 바탕이 **무엇이었는가.**
   *
   * `text` 는 사용자가 직접 쓴 문장이다 — 공고 원문이 아니다. 이름 문자열
   * (「입력한 내용」)로 구분하던 것을 필드로 올린 이유는, 그 구분이 착수
   * 판정과 Studio 게이트 **두 곳**의 분기 조건이기 때문이다.
   */
  kind: "file" | "page" | "text";
  /** 요약의 바탕이 된 원문 길이. 0 이면 본문을 못 읽은 것이다 */
  chars: number;
  error?: string;
  /**
   * Studio 가 올려 준 파일 id.
   *
   * 이걸 안 남기면 다음 단계(`analyze`)가 **같은 파일을 다시 올리고 다시
   * 파싱한다.** Document Parse 는 페이지 과금이라 20쪽짜리 공고가 40쪽이 된다.
   */
  fileId?: string;
  /**
   * parse 스텝이 낸 원문 Markdown.
   *
   * 예전에는 이걸 받아 **길이만 재고 버렸다**(`chars`). Solar 폴백이 같은
   * 문서를 또 파싱하던 이유가 그것이다.
   */
  parsed?: string;
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
        return {
          name,
          markdown: "",
          via: "fetch",
          kind: "page",
          chars: page.text.length,
        };
      }
      ctx.log(`페이지 요약 (Solar): ${name}`);
      // ⚠ `lanes.interactive` 로 감싸지 않는다. `solarSummary` → `runText` 가 이미
      // 그 레인을 잡는다 — 바깥에서 한 번 더 잡으면 같은 레인을 안팎에서 기다리는
      // 데드락이다(`pipeline.ts` 의 서류 작성이 batch 레인에서 실제로 걸렸다).
      return {
        name,
        markdown: await solarSummary(page.text, `웹페이지 「${name}」`, ctx.signal),
        via: "solar",
        kind: "page",
        chars: page.text.length,
      };
    }),
    ...(intake.sourceText && intake.sourceText.length >= 20
      ? [
          (async (): Promise<SummaryPart> => {
            ctx.log("입력한 문장 요약 (Solar)");
            return {
              name: "입력한 내용",
              markdown: await solarSummary(
                intake.sourceText!,
                "사용자가 직접 쓴 설명",
                ctx.signal,
              ),
              via: "solar",
              kind: "text",
              chars: intake.sourceText!.length,
            };
          })(),
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
  /** Studio 가 올려 준 것. 다음 단계가 이 id 로 재사용한다 */
  let fileId: string | undefined;
  /** parse 스텝이 낸 원문. 폴백이 같은 문서를 또 파싱하지 않게 붙잡아 둔다 */
  let parsedText = "";

  if (agentId) {
    try {
      ctx.log(`유효성 검사 실행: ${file.name}`);
      const uploaded = await uploadFile(file.blob, file.name);
      fileId = uploaded.id;
      const job = await runAgent({
        agentId,
        fileIds: [uploaded.id],
        include: "all",
        signal: ctx.signal,
      });
      const outputs = stepOutputs(job);
      const summary = findStep(outputs, "summarize");
      const parse = findStep(outputs, "parse");
      const parsed = parse?.json as {
        content?: { markdown?: string; text?: string };
      } | null;
      parsedText = parsed?.content?.markdown ?? parsed?.content?.text ?? "";
      const markdown = summary ? unquote(summary.text) : "";
      if (markdown.startsWith("#")) {
        ctx.log(`유효성 검사 완료: ${outputs.map((o) => o.step).join(" → ")}`);
        return {
          name: file.name,
          markdown,
          via: "validation",
          kind: "file",
          chars: parsedText.length,
          fileId,
          parsed: parsedText || undefined,
        };
      }
      ctx.log("유효성 검사 이 Markdown 을 만들지 못함 — Solar 로 대체");
    } catch (error) {
      if (isAbort(error)) throw error;
      ctx.log(`유효성 검사 실패 — Solar 로 대체: ${message(error)}`);
    }
  } else {
    ctx.log("UPSTAGE_VALIDATION_AGENT_ID 없음 — Document Parse + Solar 로 요약");
  }

  try {
    // Studio 가 이미 파싱해 줬으면 다시 파싱하지 않는다. 페이지 과금이다.
    let text = parsedText;
    let via = "validation-parse + solar";
    if (!text) {
      const parsed = await parseDocument(file.blob, { outputFormats: ["markdown"] });
      text = parsed.content?.markdown ?? parsed.content?.text ?? "";
      via = "document-parse + solar";
    }
    if (text.trim().length < 20) {
      return {
        name: file.name,
        markdown: "",
        via: "document-parse",
        kind: "file",
        chars: text.length,
        fileId,
      };
    }
    return {
      name: file.name,
      markdown: await solarSummary(text, `파일 「${file.name}」`, ctx.signal),
      kind: "file",
      via,
      chars: text.length,
      fileId,
      parsed: text,
    };
  } catch (error) {
    if (isAbort(error)) throw error;
    ctx.log(`파일을 읽지 못함: ${message(error)}`);
    return {
      name: file.name,
      markdown: "",
      via: "none",
      kind: "file",
      chars: 0,
      error: message(error),
      fileId,
    };
  }
}

/** 유효성 검사 과 같은 섹션 구조. 어느 경로로 왔든 다음 단계가 같은 모양을 받는다 */
async function solarSummary(
  text: string,
  what: string,
  signal?: AbortSignal,
): Promise<string> {
  const markdown = await runText(
    { task: "summarize", signal },
    {
      system: [
        "당신은 문서 요약 에이전트다. 주어진 원문만 근거로 문서의 목적, 핵심 사실, 요구·결정 사항,",
        "기한·금액·연락처 같은 실행 정보를 판단해 요약한다. 응답은 반드시 하나의 완결된",
        `Markdown 문서여야 한다. 인사말·설명·코드 펜스는 쓰지 않는다. ${SECTIONS} 섹션을`,
        "이 순서로 사용한다. 원문에 없는 정보는 추측하지 말고 '정보 없음' 또는 '원문 확인 필요'",
        "로 표기한다. 신청 방법·접수처·링크가 원문에 있으면 '## 실행 정보' 에 그대로 옮긴다.",
      ].join(" "),
      prompt: `${what}\n\n--- 원문 ---\n${clip(text)}`,
    },
  );
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
  question: z.string().nullish(),
});

/** bad 인데 물을 말이 없으면 이걸 쓴다. 화면이 이유만 띄우고 끝나면 안 된다 */
const DEFAULT_QUESTION = "공고문 파일을 올리거나, 공고가 실린 페이지 링크를 넣어 주세요.";

export type Verdict = {
  verdict: "good" | "bad";
  reason: string;
  /**
   * 무엇이 없어서 못 하는가 — 청사진 [3] 착수 판정의 `missing`.
   *
   * 「못 한다」만 말하면 사용자는 다음에 무엇을 해야 할지 모른다. 계약에
   * `missing: string[]` 이 있었는데 코드에는 없어서, 화면에는 이유 한 줄만
   * 나가고 있었다.
   */
  missing: string[];
  /**
   * 사용자에게 던질 **한 문장** — 청사진 [3] 의 `question`.
   *
   * `missing` 이 「무엇이 없는가」라면 이건 「그래서 무엇을 해 달라」다. 둘을
   * 나눠 두는 이유는 화면이 쓰는 자리가 다르기 때문이다 — 목록은 카드에,
   * 질문은 입력칸 안내문에 들어간다.
   */
  question: string;
};

export async function judge(
  summary: Summary,
  opts: { discovered?: Discovery | null; signal?: AbortSignal } = {},
): Promise<Verdict> {
  const signal = opts.signal;
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
      missing: ["읽을 수 있는 공고문 파일 또는 공고 페이지 링크"],
      question: failed
        ? "그 파일을 읽지 못했습니다. 다른 형식으로 올리거나, 공고 페이지 링크를 넣어 주세요."
        : DEFAULT_QUESTION,
    };
  }

  /**
   * 읽은 것이 **사용자 문장뿐이면 여기서 멈춘다.**
   *
   * 규칙으로 답할 수 있는 것을 모델에게 묻지 않는다 — 브라우저의
   * `checkValidity()` 에 물어 케이스별 프롬프트를 없앤 것과 같은 판단이다.
   * 아래 모델 판정은 요약 **텍스트**만 보므로 원문이 0바이트였다는 사실이
   * 판정자에게 도달하지 않는다. 실측: 76자 입력이 「정보 없음」으로 채운
   * 923자 요약이 되고, 그 요약에 `good` 이 떨어졌다.
   */
  const sources = readable.filter((part) => part.kind !== "text");
  if (sources.length === 0) {
    const searched = opts.discovered;
    return {
      verdict: "bad",
      reason: searched
        ? `공고 원문을 찾지 못했다. ${searched.queries.map((query) => `「${query}」`).join(" ")} 로 ${searched.hits.length}건을 봤지만 이 공고로 확신할 수 있는 페이지가 없었다.`
        : "읽은 것이 입력한 문장뿐이다 — 공고 원문을 한 글자도 읽지 않았다.",
      missing: ["공고문 파일 (PDF·HWP·이미지)", "또는 공고가 실린 페이지 링크"],
      question: searched
        ? "검색으로는 이 공고를 특정하지 못했습니다. 공고 페이지 링크나 공고문 파일을 주시면 이어서 진행합니다."
        : DEFAULT_QUESTION,
    };
  }

  try {
    const { value } = await runObject(
      // 2진 판정이라 작은 모델로 충분하다. 되묻지 않는다 — 아래 폴백이
      // 「읽을 수 있는 요약이 있으면 good」 이고, 그게 왕복보다 싸다.
      { task: "judge", tier: "small", signal },
      {
        role: "너는 문서 요약이 쓸 만한지 판정하는 보조자다.",
        schema: verdictSchema,
        repair: 0,
        rules: [
          "bad 는 다음 경우뿐이다:",
          "- 요약이 비어 있거나 '정보 없음' 뿐이다",
          "- 내용을 이해할 수 없다 (깨진 글자, 무의미한 나열)",
          "- 원문을 읽지 못했다고 적혀 있다",
          "그 외에는 전부 good 이다. 공고가 아닌 것 같다는 이유로 bad 를 주지 않는다.",
          "reason 은 한 문장.",
          "question 은 **bad 일 때만** 채운다 — 사용자에게 무엇을 더 달라고 할지 한 문장. good 이면 빈 문자열.",
        ],
        prompt: clip(summary.markdown, 12_000),
        normalize: (raw): Verdict => ({
          verdict: raw.verdict ?? "good",
          reason: raw.reason?.trim() || "읽을 수 있는 요약이다.",
          // 여기까지 왔다는 것은 원문을 읽었다는 뜻이다. 모델이 bad 를 줬어도
          // 무엇이 없는지는 규칙이 답할 수 없으므로 비워 둔다.
          missing: [],
          // bad 인데 물을 말이 비면 화면이 이유만 띄우고 끝난다.
          question: raw.verdict === "bad" ? raw.question?.trim() || DEFAULT_QUESTION : "",
        }),
      },
    );
    return value;
  } catch (error) {
    if (isAbort(error)) throw error;
    // 판정이 실패했다고 멈추지 않는다. 읽을 수 있는 요약이 있으면 good 이다.
    return {
      verdict: "good",
      reason: `판정 모델 실패, 요약이 있어 진행: ${message(error)}`,
      missing: [],
      question: "",
    };
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
