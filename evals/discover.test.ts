import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonical, overlap, queryTokens } from "@/lib/search";
import type { Link, Page } from "@/app/(app)/app/start/_lib/fetch";
import type { Intake } from "@/app/(app)/app/start/_lib/intake";
import { collectCandidates } from "@/app/(app)/app/start/_lib/research";
import {
  judge,
  type Summary,
  type SummaryPart,
} from "@/app/(app)/app/start/_lib/summarize";

/**
 * 이번 회귀는 게이트 하나가 **글자 수**를 재고 있었던 것이다.
 *
 * 사용자가 친 76자 한 줄이 Solar 요약을 거치며 923자가 됐고, 그 923자의 실질은
 * 전부 「정보 없음」이었는데 300자 상한을 넘겼다는 이유로 Studio 까지 갔다.
 * 여기 테스트는 그 게이트가 **출처**를 보는지 못박는다.
 */

const part = (over: Partial<SummaryPart> = {}): SummaryPart => ({
  name: "x",
  markdown: "# 문서 요약\n\n내용",
  via: "solar",
  kind: "page",
  chars: 4_000,
  ...over,
});

const summaryOf = (parts: SummaryPart[]): Summary => ({
  markdown: parts.map((p) => p.markdown).join("\n"),
  via: "solar",
  parts,
});

describe("착수 판정 — 원문을 안 읽었으면 진행하지 않는다", () => {
  it("읽은 것이 사용자 문장뿐이면 bad 다", async () => {
    // 923자짜리 요약이 붙어 있어도 마찬가지다. 길이는 원문의 증거가 아니다.
    const verdict = await judge(
      summaryOf([
        part({ kind: "text", name: "입력한 내용", markdown: "가".repeat(923) }),
      ]),
    );
    assert.equal(verdict.verdict, "bad");
    assert.ok(verdict.missing.length > 0, "무엇이 없는지 말해야 한다");
    // 「못 한다」로 끝나면 화면은 빨간 배너뿐이고 사용자는 화면을 버린다.
    assert.ok(verdict.question.length > 0, "무엇을 달라고 물어야 한다");
  });

  it("검색까지 하고 못 찾은 것과 안 찾아본 것을 구분해 말한다", async () => {
    const searched = await judge(summaryOf([part({ kind: "text" })]), {
      discovered: { urls: [], queries: ["포항시 AI라이브커머스"], hits: [] },
    });
    assert.match(searched.reason, /포항시 AI라이브커머스/);

    const notSearched = await judge(summaryOf([part({ kind: "text" })]));
    assert.doesNotMatch(notSearched.reason, /찾지 못했다/);
  });

  it("파일·페이지가 하나라도 있으면 규칙으로 막지 않는다", async () => {
    // 여기서부터는 모델 판정이라 이 테스트는 규칙 분기만 본다.
    const verdict = await judge(
      summaryOf([part({ kind: "text" }), part({ kind: "file", name: "공고문.pdf" })]),
    ).catch(() => null);
    // 모델을 못 부르는 환경이면 null 이다 — 규칙이 bad 를 낸 것이 아님만 확인한다.
    if (verdict)
      assert.notEqual(
        verdict.reason,
        "읽은 것이 입력한 문장뿐이다 — 공고 원문을 한 글자도 읽지 않았다.",
      );
  });

  it("본문을 아예 못 읽었으면 그 이유를 그대로 낸다", async () => {
    const verdict = await judge(
      summaryOf([part({ kind: "file", markdown: "", chars: 0, error: "HTTP 403" })]),
    );
    assert.equal(verdict.verdict, "bad");
    assert.match(verdict.reason, /403/);
    // 파일을 못 읽은 것과 아예 안 준 것은 다음에 할 일이 다르다.
    assert.match(verdict.question, /다른 형식|링크/);
  });
});

const link = (text: string, url: string, isDocument = false): Link => ({
  url,
  text,
  isDocument,
});

const intakeOf = (links: Link[], sourceText = ""): Intake => ({
  intent: "",
  files: [],
  pages: [],
  links,
  sourceText: sourceText || null,
  discovered: null,
  failures: [],
});

const pageOf = (url: string, links: Link[]): Page => ({
  url,
  title: "",
  text: "",
  links,
  formHints: [],
  placeholders: [],
});

describe("신청 URL 후보 — 2홉에서 연 페이지의 링크가 들어간다", () => {
  it("상세 페이지의 「신청하기」가 후보에 있다", () => {
    // 사용자가 던진 링크는 게시판 목록이고, 신청 링크는 상세 페이지에 있다.
    // 예전에는 `pickLinks` 가 수집보다 먼저 돌아 이 링크를 본 적이 없었다.
    const candidates = collectCandidates(
      intakeOf([link("2026년 모집 공고", "https://a.go.kr/view?id=1")]),
      summaryOf([]),
      [pageOf("https://a.go.kr/view?id=1", [link("신청하기", "https://a.go.kr/apply")])],
    );
    assert.ok(candidates.some((c) => c.url === "https://a.go.kr/apply"));
  });

  it("요약 본문 URL 이 상한을 다 먹지 않는다", () => {
    const markdown = Array.from(
      { length: 40 },
      (_, i) => `참고 https://ref.example.com/doc/${i}`,
    ).join("\n");
    const candidates = collectCandidates(
      intakeOf([link("신청하기", "https://a.go.kr/apply")]),
      summaryOf([part({ markdown })]),
      [],
    );
    assert.ok(
      candidates.some((c) => c.url === "https://a.go.kr/apply"),
      "앵커 글자가 있는 진짜 후보가 밀려나면 안 된다",
    );
  });

  it("앵커 글자가 비어도 주소로 신청 링크를 알아본다", () => {
    const candidates = collectCandidates(
      intakeOf([
        link("", "https://a.go.kr/board/apply.do"),
        ...Array.from({ length: 70 }, (_, i) => link("", `https://a.go.kr/n/${i}`)),
      ]),
      summaryOf([]),
      [],
    );
    assert.ok(candidates.some((c) => c.url === "https://a.go.kr/board/apply.do"));
  });
});

describe("검색 — 같은 문서를 두 번 열지 않는다", () => {
  it("프로토콜·www·추적 파라미터가 달라도 같은 문서다", () => {
    assert.equal(
      canonical("http://www.a.go.kr/view?id=1&utm_source=naver"),
      canonical("https://a.go.kr/view?id=1"),
    );
  });

  it("질의 토큰은 괄호를 털고 1글자를 버린다", () => {
    // 「AI」는 남는다 — 두 글자다. 버리는 것은 조사·기호로 남은 한 글자다.
    assert.deepEqual(queryTokens("[경북] 포항시 AI 라이브커머스 (온라인) 판 로"), [
      "경북",
      "포항시",
      "AI",
      "라이브커머스",
      "온라인",
    ]);
  });

  it("제목 겹침이 곧 점수다", () => {
    const tokens = queryTokens("포항시 라이브커머스 지원");
    assert.ok(overlap(tokens, "2026년 포항시 AI라이브커머스 지원기업 모집") > 0.9);
    assert.ok(overlap(tokens, "2026년 예비오션스타 기업 모집 공고") < 0.34);
  });
});
