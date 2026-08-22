import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCompetitionOpportunities } from "../scripts/competition-opportunities";

describe("parseCompetitionOpportunities — 공모전 CSV를 카드로 만든다", () => {
  it("삭제된 행을 빼고 인용 부호 안 쉼표를 제목으로 보존한다", () => {
    const competitions = parseCompetitionOpportunities(
      [
        "분류,개최년도,공모전명,홈페이지 내 삭제 여부",
        '일반,2025,"대한민국디자인전람회(일반,대학(원)생)",N',
        "청소년,2025,대한민국디자인전람회(청소년),Y",
      ].join("\n"),
    );

    assert.deepEqual(competitions, [
      {
        category: "공모전·대회",
        source: "한국디자인진흥원",
        title: "대한민국디자인전람회(일반,대학(원)생)",
        url: "https://award.kidp.or.kr/",
        content: [
          "개최년도: 2025",
          "분류: 일반",
          "공식 홈페이지의 과거 공모전 목록에서 수집한 기록입니다.",
        ].join("\n"),
      },
    ]);
  });
});
