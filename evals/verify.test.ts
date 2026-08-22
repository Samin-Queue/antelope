import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import { contractOf } from "@/lib/ai/contract";
import {
  isoDate,
  noPlaceholder,
  obtainOnly,
  oneOf,
  runRules,
  uniqueBy,
  unitMatch,
} from "@/lib/ai/verify";

const codes = (issues: ReturnType<typeof runRules>) => issues.map((i) => i.code).sort();

describe("isoDate — 형식이 맞아도 내용이 틀릴 수 있다", () => {
  it("사람 말로 쓴 마감을 버린다", () => {
    assert.deepEqual(codes(runRules({ d: "2026년 9월 중" }, [isoDate("d")])), [
      "date-format",
    ]);
  });

  it("달력에 없는 날짜를 잡는다 — 정규식은 통과하는 값이다", () => {
    assert.deepEqual(codes(runRules({ d: "2026-02-31" }, [isoDate("d")])), [
      "date-invalid",
    ]);
  });

  it("과거로 역산한 기한을 잡는다", () => {
    const rule = isoDate<{ d: string }>("d", { future: "2026-08-22" });
    assert.deepEqual(codes(runRules({ d: "2020-01-01" }, [rule])), ["date-past"]);
    assert.deepEqual(codes(runRules({ d: "2026-09-15" }, [rule])), []);
  });

  it("배열 경로를 편다", () => {
    const value = { steps: [{ due: "2026-09-15" }, { due: "언제쯤" }] };
    const issues = runRules(value, [isoDate("steps[].due")]);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].path, "steps[1].due");
  });

  it("비어 있는 값은 문제가 아니다 — 「모른다」는 정직한 답이다", () => {
    assert.deepEqual(runRules({ d: null }, [isoDate("d")]), []);
  });
});

describe("oneOf — 없는 owner 를 지어내는 것", () => {
  it("화이트리스트 밖을 잡는다", () => {
    const rule = oneOf<{ o: string }>("o", ["browser", "data", "file", "user"]);
    assert.deepEqual(codes(runRules({ o: "agent" }, [rule])), ["not-allowed"]);
    assert.deepEqual(codes(runRules({ o: "browser" }, [rule])), []);
  });
});

describe("noPlaceholder — 예시 값이 항목으로 올라오는 것", () => {
  it("전화번호·URL·이메일 꼴을 잡는다", () => {
    const value = { n: [{ l: "010-0000-0000" }, { l: "https://x.co" }, { l: "성명" }] };
    const issues = runRules(value, [noPlaceholder("n[].l")]);
    assert.equal(issues.length, 2);
  });
});

describe("uniqueBy — 같은 걸 두 번 묻는 것", () => {
  it("정규화 후 같으면 뒤엣것을 잡는다", () => {
    const value = { n: [{ l: "사업자등록번호" }, { l: "사업자 등록 번호" }] };
    const issues = runRules(value, [
      uniqueBy("n[].l", (item) =>
        String(item ?? "")
          .replace(/\s/g, "")
          .toLowerCase(),
      ),
    ]);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].path, "n[1].l");
  });
});

describe("unitMatch — 「총사업비 (천원)」에 원 단위", () => {
  it("자릿수가 단위를 안 따르면 잡는다", () => {
    assert.equal(unitMatch("총사업비 (천원)", "100,000,000").length, 1);
  });

  it("단위를 따른 값은 통과한다", () => {
    assert.equal(unitMatch("총사업비 (천원)", "100000").length, 0);
  });

  it("단위 표기가 없는 라벨은 대상이 아니다", () => {
    assert.equal(unitMatch("총사업비", "100000000").length, 0);
  });
});

describe("obtainOnly — 위조를 막는 유일한 reject", () => {
  it("발급 서류를 작성으로 분류하면 되묻게 한다", () => {
    const value = { author: [{ label: "사업자등록증 사본" }] };
    const issues = runRules(value, [obtainOnly("author[].label")]);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "reject", "이건 값 하나 틀린 것과 급이 다르다");
  });

  it("작성 서류는 통과한다", () => {
    const value = { author: [{ label: "사업계획서" }, { label: "자기소개서" }] };
    assert.deepEqual(runRules(value, [obtainOnly("author[].label")]), []);
  });
});

describe("contractOf — 스키마에서 파생한 계약", () => {
  const needs = z.object({
    needs: z
      .array(
        z.object({
          label: z.string().nullish(),
          kind: z.enum(["text", "file"]).nullish(),
          options: z.array(z.string()).nullish(),
        }),
      )
      .nullish(),
  });

  it("배열 원소의 필드를 안 빠뜨린다", () => {
    // 배열이 깊이를 소비하면 `[{ "label": …, … }]` 가 되어 계약이 사라진다.
    const contract = contractOf(needs);
    for (const field of ["label", "kind", "options"]) {
      assert.ok(contract.includes(`"${field}"`), `${field} 가 계약에 없다: ${contract}`);
    }
  });

  it("enum 을 고를 값 목록으로 낸다", () => {
    assert.ok(contractOf(needs).includes('"text"|"file"'));
  });

  it("nullish 를 `| null` 로 접는다 — anyOf 덤프가 아니라", () => {
    const contract = contractOf(needs);
    assert.ok(contract.includes("| null"));
    assert.ok(!contract.includes("anyOf"), contract);
  });
});
