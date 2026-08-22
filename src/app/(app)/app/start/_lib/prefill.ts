import { hasDb } from "@/lib/db";
import { recallForFields } from "@/app/(labs)/lab/notice/_lib/memory";

import type { Ctx } from "./intake";
import type { Need } from "./types";

/**
 * 5단계 — 지식베이스로 선채움.
 *
 * 지난 신청에서 입력한 값이 있으면 다시 묻지 않는다. 조회는 label 정확 일치 →
 * 임베딩 유사도 순서라 "상시근로자 수" 로 물어도 "현재 직원 수" 로 저장한 값을 찾는다.
 *
 * 실패는 삼킨다. 기억을 못 꺼냈다고 신청이 막히면 안 된다 — 그냥 사람에게 묻는다.
 */
export async function prefill(
  needs: Need[],
  userId: string | null,
  ctx: Ctx,
): Promise<Need[]> {
  if (!userId) {
    ctx.log("로그인 전 — 지식베이스를 조회하지 않음");
    return needs;
  }
  if (!hasDb()) {
    ctx.log("DATABASE_URL 없음 — 지식베이스를 조회하지 않음");
    return needs;
  }

  // 파일은 기억으로 채울 수 없다. 글자로 된 항목만 묻는다.
  const askable = needs.filter((need) => need.kind !== "file");
  if (askable.length === 0) return needs;

  try {
    const found = await recallForFields(
      userId,
      askable.map((need) => need.label),
    );
    let filled = 0;
    const next = needs.map((need) => {
      const memory = found[need.label];
      if (!memory || need.kind === "file") return need;
      filled += 1;
      return {
        ...need,
        value: memory.value,
        from: "memory" as const,
        memoryLabel: memory.label !== need.label ? memory.label : undefined,
      };
    });
    ctx.log(`지식베이스에서 ${filled}개 채움 (${askable.length}개 중)`);
    return next;
  } catch (error) {
    ctx.log(
      `지식베이스 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
    );
    return needs;
  }
}
