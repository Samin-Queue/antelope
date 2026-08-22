import { z } from "zod";

import { isAbort, runObject } from "@/lib/ai/gateway";
import { noPlaceholder } from "@/lib/ai/verify";
import { env } from "@/lib/env";
import { toEvidence, type Evidence } from "@/lib/grounding";
import {
  findStep,
  parsedElements,
  runAgent,
  stepOutputs,
  verdictOf,
  type Verdict,
} from "@/lib/upstage-studio";
import { BRIEF, CHECK } from "@/app/(labs)/lab/analysis/_lib/workflow";

import type { IntakeFile } from "./fetch";
import type { Ctx } from "./intake";
import { clip } from "./llm";
import { makeNeed } from "./needs";
import { parseBlocks } from "./render/blocks";
import { renderPdf } from "./render/pdf";
import type { Summary } from "./summarize";
import type { Need } from "./types";

/**
 * 4단계 — 정밀 분석.
 *
 * 모은 파일 전부를 정보 분석(Studio: parse → classify → extract-*) 한 job 에 넣는다.
 * 요약은 사람이 읽으려고 만든 것이고, 이건 폼을 채우려고 만든 것이다 — 필드마다
 * 입력 종류·필수 여부·원문 근거가 붙어 온다.
 *
 * 파일이 없거나(문장만 입력) 에이전트가 없으면 Solar 가 요약에서 같은 모양을
 * 만든다. 어느 경로였는지 `via` 로 남긴다.
 */
export type Analysis = {
  needs: Need[];
  applicationType: string | null;
  title: string | null;
  /**
   * 정보 분석 이 정돈한 신청 준비 문서.
   *
   * 필드 목록은 폼을 채우려고 만든 것이고 이건 **사람과 계획 에이전트가 읽으려고**
   * 만든 것이다. Solar 로 떨어진 경로에서는 없다.
   */
  brief: string | null;
  via: "analysis" | "solar" | "none";
  /**
   * 원문 요소와 그 좌표.
   *
   * 「이 값 어디서 나왔어?」에 답하는 재료다. Studio 를 안 탄 경로(링크·문장
   * 입력, Solar 폴백)에서는 비어 있고, 화면은 그때 근거 패널을 안 그린다 —
   * 아무 블록이나 칠하면 하이라이트가 근거인 척하는 장식이 된다.
   */
  evidence: Evidence[];
  /**
   * Studio `validate` 스텝의 판정.
   *
   * 모델이 「잘 된 것 같다」고 말한 게 아니라 규칙이 통과·실패를 센 것이다.
   * Solar 로 떨어진 경로에는 없다(`null`) — 없는 검사를 통과한 것처럼
   * 보이게 하지 않는다.
   */
  verdict: Verdict | null;
};

const APPLICATION_TYPES = [
  "JOB_APPLICATION",
  "SCHOLARSHIP_APPLICATION",
  "HOUSING_APPLICATION",
  "COMPETITION_ENTRY",
  "GRANT_SUPPORT_APPLICATION",
  "PERMIT_APPLICATION",
  "GENERAL_APPLICATION",
] as const;

const INPUT_TYPES = [
  "TEXT",
  "TEXTAREA",
  "DATE",
  "NUMBER",
  "SELECT",
  "CHECKBOX",
  "FILE",
] as const;

/**
 * ⚠ enum 을 **스키마에 적는다.** 계약 문장이 여기서 파생되므로, 문자열로 두면
 * 모델이 고를 값 목록이 프롬프트에서 사라진다. 대신 `.nullish()` 는 유지한다 —
 * 값이 없으면 키를 생략하는 것이 LLM 의 기본 습성이다.
 */
const fieldSchema = z.object({
  applicationType: z.enum(APPLICATION_TYPES).nullish(),
  applicationTitle: z.string().nullish(),
  fields: z
    .array(
      z.object({
        key: z.string().nullish(),
        label: z.string().nullish(),
        inputType: z.enum(INPUT_TYPES).nullish(),
        required: z.boolean().nullish(),
        stage: z.string().nullish(),
        documentName: z.string().nullish(),
        /**
         * 공고가 지정한 서식 파일 이름. Studio 추출 스키마가 이미 내주는데
         * 여기 없어서 zod strip 이 지우고 있었다 — `fillTemplates` 가 파일명
         * 매칭으로 대신 찾던 바로 그 값이다.
         */
        formName: z.string().nullish(),
        instructions: z.string().nullish(),
        source: z.string().nullish(),
      }),
    )
    .nullish(),
});

type Fields = z.infer<typeof fieldSchema>;

export async function analyze(
  files: IntakeFile[],
  summary: Summary,
  ctx: Ctx,
): Promise<Analysis> {
  const agentId = env.UPSTAGE_ANALYSIS_AGENT_ID;

  /**
   * 읽을 파일이 없으면 **만들어서라도 태운다.**
   *
   * 링크 하나나 문장만 준 입력은 Studio 를 한 번도 안 탔다. Solar 가 요약에서
   * 필드를 뽑긴 하지만 분류 분기도, 준비 문서도, 원문 좌표도 없다 — 같은 제품이
   * 입력 종류에 따라 다른 성능을 낸다.
   *
   * 그런데 그때도 **읽을 내용은 이미 있다.** Solar 가 페이지 본문과 사용자
   * 문장을 정돈해 둔 요약이다. Document Parse 가 평문을 안 받을 뿐이다.
   */
  const studioFiles =
    files.length > 0 || !agentId ? files : await synthesize(summary, ctx);

  if (studioFiles.length > 0 && agentId) {
    try {
      /**
       * 요약 단계가 이미 올린 파일은 **다시 올리지 않는다.**
       *
       * 예전에는 같은 파일이 두 번 올라가고 두 번 파싱됐다 — Document Parse 는
       * 페이지 과금이라 20쪽 공고가 40쪽이 된다. 요약이 남긴 `fileId` 로
       * 되짚고, 없는 것만 새로 올린다(research 가 새로 받아 온 첨부).
       */
      const known = new Map(
        summary.parts
          .filter((part) => part.fileId)
          .map((part) => [part.name, part.fileId!] as const),
      );
      const fresh = studioFiles.filter((file) => !known.has(file.name));
      ctx.log(
        `정보 분석 실행: 파일 ${studioFiles.length}개` +
          (known.size ? ` (요약이 올린 ${known.size}개 재사용)` : ""),
      );
      const done = await runAgent({
        agentId,
        fileIds: [...known.values()],
        files: fresh.map((file) => ({ blob: file.blob, name: file.name })),
        include: "all",
        timeoutMs: 240_000,
        signal: ctx.signal,
      });
      const outputs = stepOutputs(done);
      const extract = findStep(outputs, "extract");
      const parsed = fieldSchema.safeParse(extract?.json);
      if (!parsed.success || !parsed.data.fields?.length) {
        throw new Error("정보 분석 이 필드 목록을 만들지 못했습니다.");
      }
      const brief = unquote(findStep(outputs, BRIEF)?.text ?? "");
      const evidence = toEvidence(parsedElements(findStep(outputs, "parse")));
      const verdict = verdictOf(outputs, CHECK);
      ctx.log(
        `정보 분석 완료: ${outputs.map((o) => o.step).join(" → ")} · 필드 ${parsed.data.fields.length}개` +
          (brief
            ? ` · 준비 문서 ${brief.length.toLocaleString()}자`
            : " · 준비 문서 없음") +
          (evidence.length ? ` · 근거 요소 ${evidence.length}개` : " · 근거 없음"),
      );
      /**
       * 실패한 검사만 말한다.
       *
       * 통과한 것까지 늘어놓으면 카드가 「이상 없음」 스무 줄로 덮여서 정작
       * 실패 한 줄이 안 보인다. 이유 문자열에는 좌변 실제값이 들어 있어
       * 「왜 red 인가」를 되물을 필요가 없다.
       */
      if (verdict) {
        const failed = verdict.checks.filter((check) => !check.passed);
        ctx.log(
          `Studio 검사 ${verdict.verdict}: ${verdict.checks.length - failed.length}/${verdict.checks.length} 통과`,
        );
        for (const check of failed) {
          ctx.log(`  ✗ ${check.name} — ${check.reason.slice(0, 160)}`);
        }
      }
      return {
        ...toAnalysis(parsed.data, "analysis"),
        brief: brief || null,
        evidence,
        verdict,
      };
    } catch (error) {
      if (isAbort(error)) throw error;
      ctx.log(`정보 분석 실패 — Solar 로 대체: ${message(error)}`);
    }
  } else if (studioFiles.length === 0) {
    ctx.log("Studio 에 넘길 것을 만들지 못함 — 요약에서 Solar 가 도출");
  } else {
    ctx.log("UPSTAGE_ANALYSIS_AGENT_ID 없음 — 요약에서 Solar 가 도출");
  }

  if (!summary.markdown.trim())
    return {
      needs: [],
      applicationType: null,
      title: null,
      brief: null,
      via: "none",
      evidence: [],
      verdict: null,
    };

  try {
    const { value } = await runObject(
      { task: "analyze", log: ctx.log, signal: ctx.signal },
      {
        role: "너는 공고 요약을 읽고 신청 양식에 필요한 필드를 설계하는 분석가다.",
        schema: fieldSchema,
        rules: [
          "- 신청 양식에 실제로 필요한 필드만 순서대로. label 은 한글, key 는 영문 camelCase.",
          "- 제출 서류는 FILE 로 두고 documentName 에 서류 이름을 적는다.",
          "- formName 은 공고가 지정한 서식 **파일 이름**이다. 없으면 빈 문자열.",
          "- source 에는 그 필드를 요구한 요약 문장을 그대로 옮긴다.",
          "- 요약에 없는 것을 지어내지 않는다. 최대 20개.",
        ],
        verify: [noPlaceholder("fields[].label")],
        prompt: clip(summary.markdown, 12_000),
        normalize: (raw) => toAnalysis(raw, "solar"),
      },
    );
    return value;
  } catch (error) {
    if (isAbort(error)) throw error;
    ctx.log(`Solar 도출 실패: ${message(error)}`);
    return {
      needs: [],
      applicationType: null,
      title: null,
      brief: null,
      via: "none",
      evidence: [],
      verdict: null,
    };
  }
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

function toAnalysis(data: Fields, via: Analysis["via"]): Analysis {
  const needs = (data.fields ?? [])
    .map((field) =>
      makeNeed({
        label: field.label?.trim() || field.documentName?.trim() || field.key || "",
        kind: field.inputType,
        required: field.required,
        source: "analysis",
        why: field.source?.trim() || field.instructions?.trim() || null,
        formName: field.formName,
      }),
    )
    .filter((need): need is Need => need !== null)
    .slice(0, 20);
  return {
    needs,
    applicationType: data.applicationType?.trim() || null,
    title: data.applicationTitle?.trim() || null,
    brief: null,
    via,
    evidence: [],
    verdict: null,
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Studio 에 넘길 것이 없을 때 만들어 준다.
 *
 * Document Parse 가 받는 것은 PDF·이미지·오피스 문서다. 평문을 안 받으므로
 * Solar 가 정돈해 둔 요약을 **PDF 로 찍어** 올린다. 왕복이 한 번 늘지만, 그
 * 대가로 링크 하나짜리 입력도 분류 → 분기 추출 → 준비 문서 → 원문 좌표까지
 * 파일을 올렸을 때와 같은 길을 탄다.
 *
 * 실패하면 조용히 비운다. 이건 **덧붙이는 경로**라, 여기서 던지면 예전에는
 * 그냥 Solar 로 가던 입력이 통째로 죽는다.
 */
const MIN_SYNTH_CHARS = 300;

async function synthesize(summary: Summary, ctx: Ctx): Promise<IntakeFile[]> {
  const text = summary.markdown.trim();
  if (text.length < MIN_SYNTH_CHARS) {
    ctx.log(`Studio 에 넘길 내용이 ${text.length}자뿐 — 요약에서 Solar 가 도출`);
    return [];
  }
  try {
    // 브라우저 레인을 쓴다(`renderPdf`). 신청용 Chromium 과 같은 상한 아래다.
    const pdf = await renderPdf(parseBlocks(text), "수집 자료");
    const blob = new Blob([new Uint8Array(pdf)], { type: "application/pdf" });
    ctx.log(
      `읽을 파일이 없어 수집한 내용을 PDF 로 만들어 Studio 에 넘긴다 ` +
        `(${text.length.toLocaleString()}자 → ${Math.round(blob.size / 1024)}KB)`,
    );
    return [{ name: "수집-자료.pdf", blob, origin: "synth" }];
  } catch (error) {
    ctx.log(`PDF 로 만들지 못함 — 요약에서 Solar 가 도출: ${message(error)}`);
    return [];
  }
}
