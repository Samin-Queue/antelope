import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attemptsFor,
  budgetFor,
  RETRY_LIMIT_MS,
  RETRY_ONCE,
  shouldRetry,
} from "@/app/(app)/app/start/_lib/pipeline";
import { STAGES } from "@/app/(app)/app/start/_lib/types";

const FULL = 240_000;

describe("단계 재시도 — 싼 것만, 한 번만", () => {
  it("비싼 단계는 다시 하지 않는다", () => {
    // documents 는 혼자 45~120초다. 재시도하면 준비 시간이 통째로 배가 된다.
    for (const id of ["documents", "summarize"] as const) {
      assert.equal(attemptsFor(id), 1, id);
    }
  });

  it("뒤가 알아서 견디는 단계도 다시 하지 않는다", () => {
    for (const id of ["intake", "judge", "prefill"] as const) {
      assert.equal(attemptsFor(id), 1, id);
    }
  });

  it("싼 단계만 두 번", () => {
    for (const id of ["research", "analyze", "plan"] as const) {
      assert.equal(attemptsFor(id), 2, id);
    }
  });

  it("모든 단계가 둘 중 하나로 분류돼 있다 — 새 단계가 조용히 새지 않게", () => {
    for (const id of STAGES) assert.ok([1, 2].includes(attemptsFor(id)), id);
  });
});

describe("shouldRetry — 시간 초과는 다시 하지 않는다", () => {
  it("일시적 실패는 한 번 더", () => {
    assert.equal(shouldRetry("research", 0, false), true);
  });

  it("두 번째 실패는 끝", () => {
    assert.equal(shouldRetry("research", 1, false), false);
  });

  it("**시간 초과는 첫 실패라도 다시 하지 않는다**", () => {
    // 이걸 어기면 최악 준비 시간이 배가 된다 — 재시도가 개선이 아니라 회귀다.
    assert.equal(shouldRetry("research", 0, true), false);
    assert.equal(shouldRetry("analyze", 0, true), false);
  });

  it("재시도 대상이 아닌 단계는 처음부터 끝", () => {
    assert.equal(shouldRetry("documents", 0, false), false);
  });
});

describe("budgetFor — 두 번째는 짧게", () => {
  it("첫 시도는 온전한 상한", () => {
    assert.equal(budgetFor(0, FULL), FULL);
  });

  it("두 번째는 더 짧다", () => {
    assert.ok(budgetFor(1, FULL) < FULL);
    assert.equal(budgetFor(1, FULL), RETRY_LIMIT_MS);
  });

  it("원래 상한이 더 짧으면 그걸 넘기지 않는다", () => {
    assert.equal(budgetFor(1, 30_000), 30_000);
  });
});

describe("최악 지연", () => {
  it("재시도가 더하는 시간이 상한을 넘지 않는다", () => {
    const worst = [...RETRY_ONCE].length * RETRY_LIMIT_MS;
    // 세 단계가 모두 한 번씩 실패해 재시도를 다 써도 4분 30초를 넘지 않아야
    // 한다. 그보다 길면 데모에서 「멈춘 것」과 구분되지 않는다.
    assert.ok(worst <= 270_000, `${worst / 1000}초`);
  });
});
