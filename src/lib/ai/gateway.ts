import { generateObject, generateText, type LanguageModel } from "ai";
import type { z } from "zod";

import { systemFor } from "@/lib/ai/contract";
import { lanes, type LaneName } from "@/lib/ai/lanes";
import { withTask } from "@/lib/ai/meter";
import { issuesForModel, runRules, type Issue, type Rule } from "@/lib/ai/verify";
import { env } from "@/lib/env";
import { chatModel, tierModel, type Tier } from "@/lib/llm";

/**
 * 게이트웨이 — 호출부와 모델 사이의 **유일한** 자리.
 *
 * 여기까지 오기 전에는 횡단 관심사가 붙을 지점이 없었다. 계약 문자열은 열두
 * 곳에 복제됐고, 실패하면 곧장 폴백이라 계약을 **한 번** 어기는 것과 영영
 * 못 하는 것이 구분되지 않았으며, 형식은 맞고 내용이 틀린 값을 잡는 곳은
 * 아무 데도 없었다.
 *
 * 설계 원칙 셋:
 *
 * 1. **스키마는 계속 느슨하다.** `.nullish()` 남용은 실수가 아니라 정책이다 —
 *    LLM 은 값이 없으면 키를 생략하고, 엄격하게 굴면 필드 하나 때문에 전체가
 *    폐기된다. 조이는 일은 `normalize` 와 `verify` 가 한다.
 * 2. **폴백을 뺏지 않는다.** 체인을 다 소진하면 던진다. 호출부의 기존
 *    `try/catch` 폴백이 문장 하나 안 바뀌고 그대로 동작한다 — 그게 이관의
 *    안전장치다.
 * 3. **복구는 한 번뿐이다.** 두 번째로 같은 계약을 어기는 모델은 세 번째에도
 *    어긴다. 그때는 결정론적 폴백이 더 싸다.
 */
export type CallMeta = {
  /** 원장에 잡힐 이름. 단계 이름과 같게 둔다 */
  task: string;
  runId?: string | null;
  tier?: Tier;
  lane?: LaneName;
  signal?: AbortSignal;
  /** 폴백·강등·복구가 일어난 사실을 화면까지 보내는 통로 */
  log?: (line: string) => void;
};

export type CallResult<T> = {
  value: T;
  /** 복구 루프를 돌았는가. 원장 밖에서 이 사실을 아는 유일한 방법이다 */
  repaired: boolean;
  /** 버려진 값들. 조용히 지우지 않는다 */
  issues: Issue[];
};

export class AiGatewayError extends Error {
  constructor(
    readonly task: string,
    readonly issues: Issue[],
    cause?: unknown,
  ) {
    super(
      issues.length
        ? `[ai:${task}] 검증 실패 — ${issues.map((i) => i.message).join(" / ")}`
        : `[ai:${task}] 호출 실패`,
      { cause },
    );
  }
}

function modelFor(meta: CallMeta): LanguageModel {
  return meta.tier ? tierModel(meta.tier) : chatModel();
}

function inLane<T>(meta: CallMeta, task: () => Promise<T>): Promise<T> {
  return lanes[meta.lane ?? "interactive"](task);
}

/**
 * 구조화 출력 — 계약 · 검증 · 복구를 한 번에.
 *
 * `rules` 는 계약을 **뺀** 순수 규칙 문장만 받는다. 계약은 스키마에서 파생하고,
 * 「json」이라는 낱말은 `systemFor` 가 반드시 넣는다(없으면 Upstage 가 요청
 * 자체를 거부한다).
 */
export async function runObject<Raw, Out = Raw>(
  meta: CallMeta,
  opts: {
    role: string;
    schema: z.ZodType<Raw>;
    rules?: string[];
    prompt: string;
    /**
     * 형식은 맞는데 내용이 틀린 것. **원본(raw) 모양** 위에서 돈다.
     *
     * `reject` 면 한 번 되묻고, `drop` 이면 되묻지 않는다 — 값 하나 때문에
     * 왕복을 더 하는 것이 그 값보다 비싸다. 무엇을 버릴지는 `normalize` 가
     * `dropped()` 로 물어 정한다.
     */
    verify?: Array<Rule<Raw>>;
    /** 느슨한 원본 → 확정 모양. 기존 normalize/toAnalysis/makeNeed 가 여기로 */
    normalize?: (raw: Raw, issues: Issue[]) => Out;
    /** 몇 번까지 되물을까. 폴백이 있는 호출부는 0 이 낫다 */
    repair?: number;
    maxOutputTokens?: number;
  },
): Promise<CallResult<Out>> {
  const system = systemFor({ role: opts.role, schema: opts.schema, rules: opts.rules });
  const budget = env.AI_REPAIR === "off" ? 0 : (opts.repair ?? 1);

  let prompt = opts.prompt;
  let attempt = 0;
  let lastIssues: Issue[] = [];
  let lastError: unknown;

  while (attempt <= budget) {
    try {
      const { object } = await inLane(meta, () =>
        withTask({ task: meta.task, runId: meta.runId ?? null }, () =>
          generateObject({
            model: modelFor(meta),
            schema: opts.schema,
            system,
            prompt,
            abortSignal: meta.signal,
            maxOutputTokens: opts.maxOutputTokens,
          }),
        ),
      );

      const issues =
        env.AI_VERIFY === "off" || !opts.verify?.length
          ? []
          : runRules(object, opts.verify);
      const fatal = issues.filter((issue) => issue.severity === "reject");

      if (fatal.length === 0) {
        if (issues.length) {
          meta.log?.(`검증에서 ${issues.length}개를 버렸다: ${issues[0].message}`);
        }
        const value = (opts.normalize ? opts.normalize(object, issues) : object) as Out;
        return { value, repaired: attempt > 0, issues };
      }

      lastIssues = issues;
      if (attempt === budget) break;
      meta.log?.(`계약 위반 ${fatal.length}건 — 한 번 되묻는다`);
      prompt = `${opts.prompt}\n\n${issuesForModel(fatal)}`;
    } catch (error) {
      lastError = error;
      // 취소는 폴백으로 삼키지 않는다. 삼키면 취소된 실행이 열화된 결과를
      // 정상처럼 저장한다.
      if (isAbort(error)) throw error;
      if (attempt === budget) break;
      meta.log?.(`구조화 출력 실패 — 한 번 다시 시도한다: ${message(error)}`);
    }
    attempt += 1;
  }

  throw new AiGatewayError(meta.task, lastIssues, lastError);
}

/** 이 경로의 값이 검증에서 걸렸는가. `normalize` 가 무엇을 버릴지 정할 때 쓴다 */
export function dropped(issues: Issue[], path: string): boolean {
  return issues.some((issue) => issue.path === path);
}

/** 자유 텍스트. 계약이 없는 자리(요약·문서 본문) */
export async function runText(
  meta: CallMeta,
  opts: { system: string; prompt: string; maxOutputTokens?: number },
): Promise<string> {
  const { text } = await inLane(meta, () =>
    withTask({ task: meta.task, runId: meta.runId ?? null }, () =>
      generateText({
        model: modelFor(meta),
        system: opts.system,
        prompt: opts.prompt,
        abortSignal: meta.signal,
        maxOutputTokens: opts.maxOutputTokens,
      }),
    ),
  );
  return text;
}

export function isAbort(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
