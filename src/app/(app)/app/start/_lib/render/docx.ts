import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { type Block, type Inline } from "./blocks";

/**
 * DOCX — `docx` 패키지. 순수 JS 라 컨테이너에 얹을 것이 없다.
 *
 * 글꼴을 「맑은 고딕」으로 고정한다. 지정하지 않으면 워드가 기본 라틴 글꼴로
 * 한글을 그려 자간이 무너진다.
 */
const FONT = "맑은 고딕";

const HEADING = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
] as const;

export async function renderDocx(blocks: Block[], title: string): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  let counter = 0;

  for (const block of blocks) {
    if (block.kind !== "list") counter = 0;
    switch (block.kind) {
      case "heading":
        children.push(
          new Paragraph({
            heading: HEADING[Math.min(block.level, 4) - 1],
            spacing: { before: 240, after: 120 },
            children: runs(block.spans),
          }),
        );
        break;
      case "para":
        children.push(
          new Paragraph({ spacing: { after: 80 }, children: runs(block.spans) }),
        );
        break;
      case "quote":
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 80 },
            indent: { left: 360 },
            border: { left: { style: "single", size: 12, color: "E0A72C", space: 8 } },
            children: runs(block.spans),
          }),
        );
        break;
      case "list":
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            indent: { left: 360 + block.depth * 360 },
            children: [
              new TextRun({
                text: block.ordered ? `${++counter}. ` : "• ",
                font: FONT,
              }),
              ...runs(block.spans),
            ],
          }),
        );
        break;
      case "table":
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: block.head.map((cell) => textCell(cell, true)),
              }),
              ...block.rows.map(
                (row) =>
                  new TableRow({ children: row.map((cell) => textCell(cell, false)) }),
              ),
            ],
          }),
        );
        // 표 뒤에 빈 문단이 없으면 다음 표와 붙어 하나로 보인다.
        children.push(new Paragraph({ text: "" }));
        break;
    }
  }

  const doc = new Document({
    title,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{ children }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

function runs(spans: Inline[]): TextRun[] {
  return spans.map(
    (span) =>
      new TextRun({
        text: span.text,
        bold: span.bold,
        font: span.code ? "Consolas" : FONT,
        style: span.href ? "Hyperlink" : undefined,
      }),
  );
}

function textCell(text: string, header: boolean): TableCell {
  return new TableCell({
    shading: header ? { fill: "F4F4F5" } : undefined,
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text, bold: header, font: FONT })],
      }),
    ],
  });
}
