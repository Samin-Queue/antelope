import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeBudgetMs } from "@/app/(app)/app/start/_lib/analyze";
import type { Link } from "@/app/(app)/app/start/_lib/fetch";
import {
  HARVEST_BUDGET,
  host,
  INTAKE_BUDGET,
  isDetailCandidate,
  isDocumentCandidate,
} from "@/app/(app)/app/start/_lib/harvest";

const doc = (text: string, url: string): Link => ({ url, text, isDocument: true });
const page = (text: string, url: string): Link => ({ url, text, isDocument: false });

describe("첨부 후보 — 잡음은 모델을 부르기 전에 턴다", () => {
  it("공고문·서식은 받는다", () => {
    for (const link of [
      doc("공고문 다운로드", "https://a.go.kr/file/notice.pdf"),
      doc("[붙임1] 신청서 서식", "https://a.go.kr/down?id=3"),
      doc("모집요강.hwp", "https://a.go.kr/f/모집요강.hwp"),
    ]) {
      assert.ok(isDocumentCandidate(link), link.text);
    }
  });

  it("어느 사이트에나 있는 것은 안 받는다", () => {
    // 이 넷은 문서 확장자를 달고도 온다 — 확장자만 보면 전부 통과한다.
    for (const link of [
      doc("개인정보처리방침", "https://a.go.kr/privacy.pdf"),
      doc("이용약관 내려받기", "https://a.go.kr/terms.pdf"),
      doc("사이트맵", "https://a.go.kr/sitemap.pdf"),
      doc("이전 글 첨부", "https://a.go.kr/prev.hwp"),
    ]) {
      assert.equal(isDocumentCandidate(link), false, link.text);
    }
  });
});

describe("2홉 상세 후보 — 남의 공고로 넘어가지 않는다", () => {
  const hosts = new Set(["a.go.kr"]);
  const seedUrls = new Set(["https://a.go.kr/list"]);
  const at = (link: Link) => isDetailCandidate(link, { hosts, seedUrls });

  it("같은 사이트의 공고 상세는 연다", () => {
    assert.ok(at(page("2026 창업지원 모집 공고", "https://a.go.kr/bbs/view?id=7")));
    assert.ok(at(page("사업 안내", "https://www.a.go.kr/notice/detail/12")));
  });

  it("다른 사이트는 열지 않는다 — 거기서부터는 남의 공고다", () => {
    assert.equal(at(page("관련 공고 보기", "https://other.co.kr/bbs/view?id=1")), false);
  });

  it("시드 자신과 잡음은 열지 않는다", () => {
    assert.equal(at(page("목록", "https://a.go.kr/list")), false);
    assert.equal(at(page("개인정보처리방침", "https://a.go.kr/notice/privacy")), false);
  });

  it("공고와 무관한 글자는 열지 않는다 — 사이트 전체를 긁지 않는다", () => {
    assert.equal(at(page("조직도", "https://a.go.kr/about/org")), false);
    assert.equal(at(page("오시는 길", "https://a.go.kr/map")), false);
  });

  it("문서 링크는 상세 후보가 아니다 — 그건 1홉에서 이미 받는다", () => {
    assert.equal(at(doc("공고문", "https://a.go.kr/bbs/view.pdf")), false);
  });
});

describe("예산 — 1단계는 작고 조사 단계는 크다", () => {
  it("1단계가 더 작다", () => {
    // 여기서 받은 파일마다 요약이 Studio job 을 하나씩 돌린다. 스물네 개를
    // 받아 오면 요약이 단계 상한에 걸려 죽고 조사 단계까지 못 간다.
    assert.ok(INTAKE_BUDGET.files < HARVEST_BUDGET.files);
    assert.ok(INTAKE_BUDGET.bytes < HARVEST_BUDGET.bytes);
  });

  it("1단계는 2홉을 안 판다", () => {
    assert.equal(INTAKE_BUDGET.pages, 0);
  });

  it("조사 단계 상한이 예전 6개보다 크다 — Studio 는 수백 쪽을 받는다", () => {
    assert.ok(HARVEST_BUDGET.files >= 20);
  });
});

describe("분석 상한 — 자료가 많으면 같이 늘어난다", () => {
  it("작은 입력은 바닥값 240초", () => {
    assert.equal(analyzeBudgetMs(0), 240_000);
    assert.equal(analyzeBudgetMs(1024 * 1024), 240_000);
  });

  it("자료가 늘면 상한도 는다 — 고정 240초는 job 을 먼저 죽인다", () => {
    assert.ok(analyzeBudgetMs(40 * 1024 * 1024) > 240_000);
  });

  it("15분에서 자른다 — 그보다 오래면 매달린 것이다", () => {
    assert.equal(analyzeBudgetMs(HARVEST_BUDGET.bytes), 900_000);
    assert.equal(analyzeBudgetMs(10 * 1024 * 1024 * 1024), 900_000);
  });

  it("단조 증가한다", () => {
    let last = 0;
    for (const mb of [0, 5, 20, 40, 60, 80]) {
      const now = analyzeBudgetMs(mb * 1024 * 1024);
      assert.ok(now >= last, `${mb}MB`);
      last = now;
    }
  });
});

describe("host — www 만 턴다", () => {
  it("서브도메인은 다른 사이트로 본다", () => {
    assert.equal(host("https://www.a.go.kr/x"), "a.go.kr");
    assert.equal(host("https://a.go.kr/x"), "a.go.kr");
    assert.notEqual(host("https://sub.a.go.kr/x"), "a.go.kr");
  });

  it("망가진 URL 은 빈 문자열 — 호스트 게이트가 통과되지 않는다", () => {
    assert.equal(host("not a url"), "");
  });
});
