import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { documentKey } from "@/app/(app)/app/start/_lib/documents";
import { makeNeed, mergeNeeds, normalizeKey } from "@/app/(app)/app/start/_lib/needs";

describe("normalizeKey — 같은 항목을 두 번 묻지 않는다", () => {
  it("공백·기호·필수 표기를 무시한다", () => {
    const same = [
      "사업자등록번호",
      "사업자 등록 번호",
      "사업자등록번호 *",
      "사업자-등록-번호",
    ];
    const keys = new Set(same.map(normalizeKey));
    assert.equal(keys.size, 1, `하나로 모여야 한다: ${[...keys].join(" / ")}`);
  });

  it("다른 항목은 안 합친다", () => {
    assert.notEqual(normalizeKey("대표자명"), normalizeKey("담당자명"));
  });
});

describe("makeNeed — 항목이 아닌 것을 거른다", () => {
  it("플레이스홀더는 항목이 아니다", () => {
    for (const label of ["010-0000-0000", "https://example.com", "a@b.co"]) {
      assert.equal(makeNeed({ label, source: "research" }), null, label);
    }
  });

  it("빈 라벨과 지나치게 긴 라벨을 버린다", () => {
    assert.equal(makeNeed({ label: "   ", source: "research" }), null);
    assert.equal(makeNeed({ label: "가".repeat(61), source: "research" }), null);
  });

  it("선택지가 하나뿐이면 select 로 만들지 않는다", () => {
    const need = makeNeed({
      label: "투자 단계",
      kind: "select",
      options: ["시드"],
      source: "analysis",
    });
    assert.equal(need?.options, undefined, "고를 것이 하나면 고르라고 하지 않는다");
  });

  it("공고가 지정한 서식 이름을 들고 간다", () => {
    const need = makeNeed({
      label: "사업계획서",
      kind: "file",
      source: "analysis",
      formName: "별지1_사업계획서.hwp",
    });
    assert.equal(need?.formName, "별지1_사업계획서.hwp");
  });
});

describe("documentKey — 빈 키가 와일드카드가 되면 안 된다", () => {
  it("서류 이름의 접미어를 턴다", () => {
    assert.equal(documentKey("사업자등록증 사본 1부"), documentKey("사업자등록증"));
  });

  it("「제출 서류」는 통째로 사라진다 — 그래서 후보에서 걸러야 한다", () => {
    // 이 값이 `""` 이라는 사실 자체가 결함의 원인이었다.
    // `key.includes("")` 는 항상 참이라 아무 서류나 여기에 매칭됐다.
    assert.equal(documentKey("제출 서류"), "");
    assert.notEqual(documentKey("사업계획서"), "");
  });
});

describe("mergeNeeds — 먼저 온 목록이 우선", () => {
  it("같은 키는 하나로, 앞쪽 라벨을 남긴다", () => {
    const a = makeNeed({ label: "성명", source: "analysis" })!;
    const b = makeNeed({ label: "성 명", source: "research" })!;
    const merged = mergeNeeds([a], [b]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].label, "성명");
  });

  it("한쪽이라도 필수면 필수다", () => {
    const a = makeNeed({ label: "연락처", required: false, source: "analysis" })!;
    const b = makeNeed({ label: "연락처", required: true, source: "research" })!;
    assert.equal(mergeNeeds([a], [b])[0].required, true);
  });
});
