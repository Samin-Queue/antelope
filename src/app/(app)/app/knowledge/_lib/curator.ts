import { generateObject } from "ai";
import { z } from "zod";

import { chatModel } from "@/lib/llm";
import {
  forgetMemory,
  listMemories,
  remember,
  updateMemory,
} from "@/app/(labs)/lab/notice/_lib/memory";

/**
 * 지식 관리자.
 *
 * 사용자는 기억을 직접 고치지 않는다. 무엇을 바꿀지 말로 하면 에이전트가
 * 판단해 반영한다 — 이 컨텍스트를 관리하는 주체가 에이전트라는 사실이
 * 화면에서도 그대로 드러나야 한다.
 */
const planSchema = z.object({
  actions: z
    .array(
      z.object({
        op: z.enum(["add", "update", "delete"]).nullish(),
        /** update·delete 는 대상 항목명 */
        target: z.string().nullish(),
        label: z.string().nullish(),
        value: z.string().nullish(),
        kind: z.enum(["fact", "item", "strength", "narrative"]).nullish(),
        why: z.string().nullish(),
      }),
    )
    .nullish(),
  reply: z.string().nullish(),
});

export type CuratorAction = {
  op: "add" | "update" | "delete";
  target: string | null;
  label: string | null;
  value: string | null;
  why: string | null;
};

export async function curate(
  userId: string,
  instruction: string,
): Promise<{ reply: string; applied: CuratorAction[] }> {
  const current = await listMemories(userId);

  const { object } = await generateObject({
    model: chatModel(),
    schema: planSchema,
    system: [
      "너는 기업 지식베이스를 관리하는 담당자다. 사용자의 지시를 읽고 무엇을",
      "바꿀지 정해 JSON 으로 낸다. 키 이름을 바꾸거나 새로 만들지 않는다.",
      `{ "actions": [{ "op": "add"|"update"|"delete", "target": string|null, "label": string, "value": string, "kind": "fact"|"item"|"strength"|"narrative", "why": string }], "reply": string }`,
      "",
      "규칙:",
      "- 기존 항목을 고치거나 지울 때는 target 에 **현재 항목명을 정확히** 적는다.",
      "- 지시가 모호하면 추측해서 바꾸지 않는다. actions 를 비우고 reply 로 되묻는다.",
      "- 사실(생년월일·직원수)은 fact, 제품·기능은 item, 실적·강점은 strength,",
      "  사업계획에 쓸 긴 서술은 narrative 로 분류한다.",
      "- reply 는 무엇을 했는지 또는 무엇을 더 알아야 하는지 한국어 두세 문장.",
    ].join("\n"),
    prompt: [
      "현재 지식:",
      ...(current.length
        ? current.map((item) => `  [${item.kind}] ${item.label}: ${item.value}`)
        : ["  (비어 있음)"]),
      "",
      `지시: ${instruction}`,
    ].join("\n"),
  });

  const actions = (object.actions ?? []).filter((action) => action.op);
  const applied: CuratorAction[] = [];

  for (const action of actions) {
    const op = action.op!;
    if (op === "delete") {
      const found = current.find((item) => item.label === action.target?.trim());
      if (!found) continue;
      await forgetMemory(userId, found.id);
    } else if (op === "update") {
      const found = current.find((item) => item.label === action.target?.trim());
      if (!found) continue;
      await updateMemory(userId, found.id, {
        label: action.label?.trim() || undefined,
        value: action.value?.trim() || undefined,
        kind: action.kind ?? undefined,
      });
    } else {
      if (!action.label?.trim() || !action.value?.trim()) continue;
      await remember(userId, [
        { kind: action.kind ?? "fact", label: action.label, value: action.value },
      ]);
    }

    applied.push({
      op,
      target: action.target?.trim() || null,
      label: action.label?.trim() || null,
      value: action.value?.trim() || null,
      why: action.why?.trim() || null,
    });
  }

  return {
    reply: object.reply?.trim() || "요청을 이해하지 못했다. 조금 더 구체적으로 말해달라.",
    applied,
  };
}
