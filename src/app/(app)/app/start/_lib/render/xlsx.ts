import ExcelJS from "exceljs";

import { plain, type Block } from "./blocks";

/**
 * XLSX — `exceljs`.
 *
 * 엑셀은 문서가 아니라 표다. 공고가 엑셀 서식을 요구할 때는 대개 예산 내역서·
 * 인력 현황처럼 **표가 본체**다. 그래서 표 블록은 진짜 시트 표로 옮기고,
 * 나머지 글은 한 열짜리 줄로 남긴다 — 버리면 맥락이 사라진다.
 */
const HEADER_FILL = "FFF4F4F5";
const QUOTE_FILL = "FFFFF6E5";

export async function renderXlsx(blocks: Block[], title: string): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "Antelope";
  const sheet = book.addWorksheet(sheetName(title));

  let widest = 1;
  let counter = 0;

  for (const block of blocks) {
    if (block.kind !== "list") counter = 0;
    switch (block.kind) {
      case "heading": {
        const row = sheet.addRow([plain(block.spans)]);
        row.font = { bold: true, size: block.level === 1 ? 14 : 12 };
        if (block.level <= 2) sheet.addRow([]);
        break;
      }
      case "para":
        sheet.addRow([plain(block.spans)]);
        break;
      case "quote": {
        const row = sheet.addRow([plain(block.spans)]);
        row.getCell(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: QUOTE_FILL },
        };
        break;
      }
      case "list": {
        const marker = block.ordered ? `${++counter}. ` : "· ";
        sheet.addRow([`${"    ".repeat(block.depth)}${marker}${plain(block.spans)}`]);
        break;
      }
      case "table": {
        widest = Math.max(widest, block.head.length);
        const head = sheet.addRow(block.head);
        head.font = { bold: true };
        head.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: HEADER_FILL },
          };
          cell.border = bordered();
        });
        for (const row of block.rows) {
          sheet.addRow(row).eachCell((cell) => (cell.border = bordered()));
        }
        sheet.addRow([]);
        break;
      }
    }
  }

  // 첫 열은 글이 들어가 넓게, 나머지는 표 폭에 맞춘다.
  sheet.getColumn(1).width = 52;
  for (let index = 2; index <= widest; index++) sheet.getColumn(index).width = 22;
  sheet.getColumn(1).alignment = { vertical: "top", wrapText: true };

  return Buffer.from(await book.xlsx.writeBuffer());
}

function bordered() {
  const side = { style: "thin" as const, color: { argb: "FFCCCCCC" } };
  return { top: side, left: side, bottom: side, right: side };
}

/** 엑셀 시트 이름은 31자 제한에 `[]:*?/\` 를 못 쓴다. */
function sheetName(title: string): string {
  return title.replace(/[[\]:*?/\\]/g, "").slice(0, 31) || "문서";
}
