import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ModelMessage } from "ai";

import { pruneToolResults } from "@/lib/ai/window";
import { matchEvidence, type Evidence } from "@/lib/grounding";

const box = { x: 0, y: 0, w: 1, h: 0.05 };
const el = (id: number, text: string): Evidence => ({
  id,
  page: 1,
  category: "paragraph",
  text,
  box,
});

const NOTICE: Evidence[] = [
  el(1, "2026년 청년창업사관학교 입교생 모집 공고"),
  el(2, "접수 마감: 2026년 9월 15일 18:00 까지"),
  el(3, "지원 규모: 총 50,000천원 이내"),
  el(4, "제출 서류: 사업계획서(별지 제1호), 사업자등록증 사본"),
  el(5, "문의: 창업진흥원 창업교육팀"),
];

describe("matchEvidence — 못 찾으면 못 찾았다고 한다", () => {
  it("원문에 그대로 있으면 완전 포함으로 잡는다", () => {
    const hits = matchEvidence(NOTICE, "창업진흥원 창업교육팀");
    assert.equal(hits[0]?.evidence.id, 5);
    assert.equal(hits[0]?.score, 1);
  });

  it("날짜는 표기가 달라도 찾는다 — 이게 없으면 마감일만 근거를 못 찾았다", () => {
    const hits = matchEvidence(NOTICE, "2026-09-15");
    assert.equal(hits[0]?.evidence.id, 2, "「2026년 9월 15일」과 이어져야 한다");
  });

  it("무관한 값에는 **빈 배열**을 준다", () => {
    // 아무 블록이나 칠하면 하이라이트가 근거인 척하는 장식이 된다.
    assert.deepEqual(matchEvidence(NOTICE, "대표자 주민등록번호와 가족관계증명"), []);
  });

  it("짧은 값은 아예 찾지 않는다 — 우연히 담기기 때문이다", () => {
    // `containment` 는 질의 길이로만 정규화한다. 「사본」 두 글자는 긴 문단에
    // 통째로 들어가 1.0 이 나온다.
    assert.deepEqual(matchEvidence(NOTICE, "사본"), []);
  });

  it("모델이 문장을 다듬어도 유사도로 잡는다", () => {
    const hits = matchEvidence(NOTICE, "제출 서류는 사업계획서와 사업자등록증 사본");
    assert.equal(hits[0]?.evidence.id, 4);
  });
});

describe("pruneToolResults — 창 밖은 버리고 원본은 안 건드린다", () => {
  const snap = (n: number) =>
    ({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: `c${n}`,
          toolName: "read",
          output: { type: "text", value: `URL: https://x/${n}\n요소 …` },
        },
      ],
    }) as unknown as ModelMessage;

  const fill = {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId: "cf",
        toolName: "fill",
        output: { type: "text", value: '"이름" 에 "홍길동" 을 넣었다.' },
      },
    ],
  } as unknown as ModelMessage;

  const messages: ModelMessage[] = [
    { role: "user", content: "시작" },
    snap(1),
    snap(2),
    snap(3),
    fill,
  ];

  const out = pruneToolResults(messages, {
    keep: 2,
    isBulky: (text) => text.startsWith("URL: "),
    stub: "[지나간 화면]",
  });

  const values = out
    .filter((m) => m.role === "tool")
    .map((m) => (m.content as Array<{ output: { value: string } }>)[0].output.value);

  it("최근 두 장만 원문으로 남는다", () => {
    assert.equal(values[0], "[지나간 화면]");
    assert.ok(values[1].startsWith("URL: https://x/2"));
    assert.ok(values[2].startsWith("URL: https://x/3"));
  });

  it("스냅샷이 아닌 도구 결과는 안 건드린다", () => {
    assert.ok(values[3].includes("홍길동"));
  });

  it("원본 배열을 변형하지 않는다 — SDK 가 같은 배열을 다시 쓴다", () => {
    const first = (messages[1].content as Array<{ output: { value: string } }>)[0];
    assert.ok(first.output.value.startsWith("URL: https://x/1"));
  });
});
