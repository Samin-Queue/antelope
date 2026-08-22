import { generateObject } from "ai";
import { z } from "zod";

import { env } from "@/lib/env";
import { findStep, runAgent, stepOutputs } from "@/lib/upstage-studio";
import { BRIEF } from "@/app/(labs)/lab/analysis/_lib/workflow";

import type { IntakeFile } from "./fetch";
import type { Ctx } from "./intake";
import { bigModel, clip } from "./llm";
import { makeNeed } from "./needs";
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
};

const fieldSchema = z.object({
  applicationType: z.string().nullish(),
  applicationTitle: z.string().nullish(),
  fields: z
    .array(
      z.object({
        key: z.string().nullish(),
        label: z.string().nullish(),
        inputType: z.string().nullish(),
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

  if (files.length > 0 && agentId) {
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
      const fresh = files.filter((file) => !known.has(file.name));
      ctx.log(
        `정보 분석 실행: 파일 ${files.length}개` +
          (known.size ? ` (요약이 올린 ${known.size}개 재사용)` : ""),
      );
      const done = await runAgent({
        agentId,
        fileIds: [...known.values()],
        files: fresh.map((file) => ({ blob: file.blob, name: file.name })),
        include: "all",
        timeoutMs: 240_000,
      });
      const outputs = stepOutputs(done);
      const extract = findStep(outputs, "extract");
      const parsed = fieldSchema.safeParse(extract?.json);
      if (!parsed.success || !parsed.data.fields?.length) {
        throw new Error("정보 분석 이 필드 목록을 만들지 못했습니다.");
      }
      const brief = unquote(findStep(outputs, BRIEF)?.text ?? "");
      ctx.log(
        `정보 분석 완료: ${outputs.map((o) => o.step).join(" → ")} · 필드 ${parsed.data.fields.length}개` +
          (brief
            ? ` · 준비 문서 ${brief.length.toLocaleString()}자`
            : " · 준비 문서 없음"),
      );
      return { ...toAnalysis(parsed.data, "analysis"), brief: brief || null };
    } catch (error) {
      ctx.log(`정보 분석 실패 — Solar 로 대체: ${message(error)}`);
    }
  } else if (files.length === 0) {
    ctx.log("파일이 없어 정보 분석 을 건너뜀 — 요약에서 Solar 가 도출");
  } else {
    ctx.log("UPSTAGE_ANALYSIS_AGENT_ID 없음 — 요약에서 Solar 가 도출");
  }

  if (!summary.markdown.trim())
    return { needs: [], applicationType: null, title: null, brief: null, via: "none" };

  try {
    const { object } = await generateObject({
      model: bigModel(),
      schema: fieldSchema,
      system: [
        "너는 공고 요약을 읽고 신청 양식에 필요한 필드를 설계하는 분석가다.",
        "결과를 아래 JSON 구조 그대로 낸다. 키 이름을 바꾸거나 새로 만들지 않는다.",
        `{ "applicationType": "JOB_APPLICATION"|"SCHOLARSHIP_APPLICATION"|"HOUSING_APPLICATION"|"COMPETITION_ENTRY"|"GRANT_SUPPORT_APPLICATION"|"PERMIT_APPLICATION"|"GENERAL_APPLICATION", "applicationTitle": string, "fields": [{ "key": string, "label": string, "inputType": "TEXT"|"TEXTAREA"|"DATE"|"NUMBER"|"SELECT"|"CHECKBOX"|"FILE", "required": boolean, "stage": "BASIC"|"ELIGIBILITY"|"DOCUMENTS"|"ESSAY"|"REVIEW"|"SUBMISSION", "documentName": string, "instructions": string, "source": string }] }`,
        "",
        "- 신청 양식에 실제로 필요한 필드만 순서대로. label 은 한글, key 는 영문 camelCase.",
        "- 제출 서류는 FILE 로 두고 documentName 에 서류 이름을 적는다.",
        "- source 에는 그 필드를 요구한 요약 문장을 그대로 옮긴다.",
        "- 요약에 없는 것을 지어내지 않는다. 최대 20개.",
      ].join("\n"),
      prompt: clip(summary.markdown, 12_000),
    });
    return toAnalysis(object, "solar");
  } catch (error) {
    ctx.log(`Solar 도출 실패: ${message(error)}`);
    return { needs: [], applicationType: null, title: null, brief: null, via: "none" };
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
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
