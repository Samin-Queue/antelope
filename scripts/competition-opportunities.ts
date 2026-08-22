import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const COMPETITION_DATA_PATH = join(process.cwd(), "competition_data.csv");
const COMPETITION_URL = "https://award.kidp.or.kr/";

const competitionRowSchema = z.tuple([
  z.string(),
  z.string().regex(/^\d{4}$/),
  z.string().min(1),
  z.enum(["N", "Y"]),
]);

export type CompetitionOpportunity = {
  readonly category: string;
  readonly source: string;
  readonly title: string;
  readonly url: string;
  readonly content: string;
};

function csvCells(line: string): readonly string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

export function parseCompetitionOpportunities(
  csv: string,
): readonly CompetitionOpportunity[] {
  return csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      if (!line.trim()) return [];
      const parsed = competitionRowSchema.safeParse(csvCells(line));
      if (!parsed.success) return [];
      const [kind, year, title, deleted] = parsed.data;
      if (deleted === "Y") return [];

      return [
        {
          category: "공모전·대회",
          source: "한국디자인진흥원",
          title,
          url: COMPETITION_URL,
          content: [
            `개최년도: ${year}`,
            `분류: ${kind}`,
            "공식 홈페이지의 과거 공모전 목록에서 수집한 기록입니다.",
          ].join("\n"),
        },
      ];
    });
}

export async function competitionOpportunities(): Promise<
  readonly CompetitionOpportunity[]
> {
  return parseCompetitionOpportunities(await readFile(COMPETITION_DATA_PATH, "utf8"));
}
