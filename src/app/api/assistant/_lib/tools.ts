import { tool } from "ai";
import { z } from "zod";

import {
  getGoal,
  listGoals,
  OUTCOME_LABEL,
  STAGE_LABEL,
} from "@/app/(app)/app/_lib/goals";
import { listMemories, recallForFields } from "@/app/(labs)/lab/notice/_lib/memory";

/**
 * 어시스턴트가 사용자 데이터를 읽는 창구.
 *
 * 두 가지를 지킨다.
 *
 * 1. **`userId` 는 인자가 아니라 클로저다.** 도구 인자로 두면 모델이 남의 id 를
 *    지어낼 수 있고, 그 순간 이 채팅창이 다른 사람의 지식베이스를 읽는 통로가
 *    된다. 세션에서 온 값만 쓴다.
 * 2. **실패가 스트림을 끊지 않는다.** 도구가 던지면 AI SDK 가 `tool-error` 로
 *    삼켜 모델이 무슨 일이 났는지 모른 채 답을 지어낸다. 문장으로 돌려준다.
 */
const MAX_MEMORIES = 60;
const MAX_GOALS = 20;
/** 값 한 칸의 상한. 서술형 기억은 문단째 들어 있을 수 있다 */
const MAX_VALUE = 300;

function clip(value: string, limit = MAX_VALUE): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

async function guard<T>(label: string, run: () => Promise<T>): Promise<T | string> {
  try {
    return await run();
  } catch (error) {
    return `${label} 실패: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function assistantTools(userId: string) {
  return {
    search_knowledge: tool({
      description:
        "지식 베이스에서 항목을 이름으로 찾는다. 저장된 이름이 달라도 의미가 " +
        "가까우면 찾아낸다(상시근로자 수 → 현재 직원 수). 사용자가 자기 정보를 " +
        "물으면 기억에 의존하지 말고 이것부터 부른다.",
      inputSchema: z.object({
        labels: z
          .array(z.string())
          .min(1)
          .max(10)
          .describe('찾을 항목 이름들. 예: ["생년월일", "상시근로자 수"]'),
      }),
      execute: ({ labels }) =>
        guard("지식 조회", async () => {
          const found = await recallForFields(userId, labels);
          const hits = Object.entries(found).map(([asked, memory]) => ({
            asked,
            // 물은 이름과 저장된 이름이 다르면 그 사실이 답의 일부다.
            storedAs: memory.label,
            value: clip(memory.value),
            source: memory.sourceNotice,
          }));
          const missing = labels.filter((label) => !found[label]);
          return { hits, missing };
        }),
    }),

    list_knowledge: tool({
      description:
        "지식 베이스에 저장된 항목을 전부 훑는다. 「나에 대해 뭘 알아?」처럼 " +
        "무엇이 있는지 자체를 물을 때 쓴다.",
      inputSchema: z.object({}),
      execute: () =>
        guard("지식 목록", async () => {
          const rows = await listMemories(userId);
          return {
            total: rows.length,
            items: rows.slice(0, MAX_MEMORIES).map((row) => ({
              kind: row.kind,
              label: row.label,
              value: clip(row.value, 120),
            })),
            truncated: rows.length > MAX_MEMORIES,
          };
        }),
    }),

    list_goals: tool({
      description: "지난 목표(공고 하나에 대한 도전)와 진행 상태를 최근 순으로 가져온다.",
      inputSchema: z.object({}),
      execute: () =>
        guard("목표 목록", async () => {
          const goals = await listGoals(userId);
          return {
            total: goals.length,
            items: goals.slice(0, MAX_GOALS).map((goal) => ({
              id: goal.id,
              title: goal.title,
              organization: goal.organization,
              deadline: goal.deadline,
              stage: STAGE_LABEL[goal.stage],
              outcome: goal.outcome ? OUTCOME_LABEL[goal.outcome] : null,
              updatedAt: goal.updatedAt.toISOString().slice(0, 10),
            })),
            truncated: goals.length > MAX_GOALS,
          };
        }),
    }),

    get_goal: tool({
      description:
        "목표 하나의 준비 내용을 읽는다 — 요약, 필요한 항목과 채워진 값, 아직 " +
        "빈 칸. id 는 list_goals 가 준 것을 그대로 쓴다.",
      inputSchema: z.object({ id: z.string().describe("list_goals 의 id") }),
      execute: ({ id }) =>
        guard("목표 조회", async () => {
          const goal = await getGoal(userId, id);
          if (!goal) return { found: false as const };

          // ⚠ `snapshot` 은 통째로 넘기면 근거 좌표·파일 목록까지 딸려와 컨텍스트를
          // 통째로 먹는다. 사람이 물어볼 만한 것만 뽑는다.
          const snapshot = (goal.snapshot ?? {}) as {
            summary?: { markdown?: string } | null;
            applyUrl?: string | null;
            needs?: Array<{
              label?: string;
              required?: boolean;
              value?: string | null;
            }>;
          };
          const needs = Array.isArray(snapshot.needs) ? snapshot.needs : [];

          return {
            found: true as const,
            title: goal.title,
            organization: goal.organization,
            deadline: goal.deadline,
            stage: STAGE_LABEL[goal.stage],
            outcome: goal.outcome ? OUTCOME_LABEL[goal.outcome] : null,
            applyUrl: snapshot.applyUrl ?? null,
            summary: snapshot.summary?.markdown
              ? clip(snapshot.summary.markdown, 1_200)
              : null,
            needs: needs.slice(0, 40).map((need) => ({
              label: need.label ?? "",
              required: need.required ?? false,
              filled: Boolean(need.value),
            })),
          };
        }),
    }),
  };
}
