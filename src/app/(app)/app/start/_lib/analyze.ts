import { generateObject } from "ai";
import { z } from "zod";

import { env, required } from "@/lib/env";
import { findStep, stepOutputs, uploadFile, waitForJob } from "@/lib/upstage-studio";
import { BRIEF } from "@/app/(labs)/lab/michael/_lib/workflow";

import type { IntakeFile } from "./fetch";
import type { Ctx } from "./intake";
import { bigModel, clip } from "./llm";
import { makeNeed } from "./needs";
import type { Summary } from "./summarize";
import type { Need } from "./types";

/**
 * 4단계 — 정밀 분석.
 *
 * 모은 파일 전부를 Michael(Studio: parse → classify → extract-*) 한 job 에 넣는다.
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
   * Michael 이 정돈한 신청 준비 문서.
   *
   * 필드 목록은 폼을 채우려고 만든 것이고 이건 **사람과 계획 에이전트가 읽으려고**
   * 만든 것이다. Solar 로 떨어진 경로에서는 없다.
   */
  brief: string | null;
  via: "michael" | "solar" | "none";
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
  const agentId = env.UPSTAGE_MICHAEL_AGENT_ID;

  if (files.length > 0 && agentId) {
    try {
      ctx.log(`Michael 실행: 파일 ${files.length}개`);
      const uploaded = await Promise.all(
        files.map((file) => uploadFile(file.blob, file.name)),
      );
      const job = await createMultiFileJob(
        agentId,
        uploaded.map((file) => file.id),
      );
      const done = await waitForJob(job.id, { include: "all", timeoutMs: 240_000 });
      const outputs = stepOutputs(done);
      const extract = findStep(outputs, "extract");
      const parsed = fieldSchema.safeParse(extract?.json);
      if (!parsed.success || !parsed.data.fields?.length) {
        throw new Error("Michael 이 필드 목록을 만들지 못했습니다.");
      }
      const brief = unquote(findStep(outputs, BRIEF)?.text ?? "");
      ctx.log(
        `Michael 완료: ${outputs.map((o) => o.step).join(" → ")} · 필드 ${parsed.data.fields.length}개` +
          (brief
            ? ` · 준비 문서 ${brief.length.toLocaleString()}자`
            : " · 준비 문서 없음"),
      );
      return { ...toAnalysis(parsed.data, "michael"), brief: brief || null };
    } catch (error) {
      ctx.log(`Michael 실패 — Solar 로 대체: ${message(error)}`);
    }
  } else if (files.length === 0) {
    ctx.log("파일이 없어 Michael 을 건너뜀 — 요약에서 Solar 가 도출");
  } else {
    ctx.log("UPSTAGE_MICHAEL_AGENT_ID 없음 — 요약에서 Solar 가 도출");
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
        source: "michael",
        why: field.source?.trim() || field.instructions?.trim() || null,
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

/**
 * 파일 여러 개를 한 job 에 넣는다.
 * `@/lib/upstage-studio` 의 createJob 은 파일 하나만 받는다 — 공용 부품을 고치지
 * 않는다는 규칙 때문에 여기서 따로 부른다.
 */
async function createMultiFileJob(
  agentId: string,
  fileIds: string[],
): Promise<{ id: string }> {
  // 키 해석은 `upstage-studio.ts` 의 authHeader 와 **같아야 한다.** Studio 전용
  // 키가 따로 있는데 v1 키로 job 을 만들면 파일과 에이전트가 다른 계정에 있게 돼
  // 403 No access to file 로 죽는다 — 증상이 파일 쪽 오류로 나와 원인을 못 찾는다.
  const key = env.UPSTAGE_STUDIO_API_KEY || required("UPSTAGE_API_KEY");
  const response = await fetch("https://api.upstage.ai/v2/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: agentId,
      input: [
        {
          role: "user",
          content: fileIds.map((id) => ({ type: "input_file", file_id: id })),
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`[studio] responses ${response.status}: ${await response.text()}`);
  }
  const created = (await response.json()) as { id?: string };
  if (!created.id) throw new Error("Studio 가 job id 를 돌려주지 않았습니다.");
  return { id: created.id };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
