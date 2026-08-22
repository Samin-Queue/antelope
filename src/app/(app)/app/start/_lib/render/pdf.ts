import { existsSync } from "node:fs";
import { chromium, type Browser } from "playwright";

import { lanes } from "@/lib/ai/lanes";

import { plain, type Block, type Inline } from "./blocks";

/**
 * PDF — Chromium 으로 찍는다.
 *
 * 새 의존성이 없고 컨테이너에 `fonts-noto-cjk` 가 있어 한글이 그대로 나온다.
 */
const SYSTEM_CHROMIUM = "/usr/bin/chromium";

/**
 * 브라우저는 **한 번만 띄운다.**
 *
 * 문서마다 launch/close 하고 있었고, `pdfCopy` 가 한 번 더 한다. 문서 작성이
 * 병렬로 바뀌면 3편 = Chromium 6개가 동시에 뜬다 — 이 컨테이너에서 먼저 죽는
 * 자원이 정확히 그것이다. 인스턴스를 재사용하고 페이지만 새로 연다.
 */
let shared: Browser | null = null;

async function browser(): Promise<Browser> {
  if (shared?.isConnected()) return shared;
  const executablePath = existsSync(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : undefined;
  shared = await chromium.launch({
    headless: true,
    ...(executablePath
      ? { executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
      : {}),
  });
  return shared;
}

export function renderPdf(blocks: Block[], title: string): Promise<Buffer> {
  // 브라우저 레인 아래에서만 돈다. 신청용 Playwright·Xvfb 와 **같은** 레인이다 —
  // 종류별로 나누면 합이 상한을 넘는다.
  return lanes.browser(async () => {
    const page = await (await browser()).newPage();
    try {
      await page.setContent(html(blocks, title), { waitUntil: "load" });
      return await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", bottom: "20mm", left: "18mm", right: "18mm" },
      });
    } finally {
      await page.close().catch(() => {});
    }
  });
}

function html(blocks: Block[], title: string): string {
  const body: string[] = [];
  let list: { ordered: boolean; depth: number } | null = null;

  const closeList = () => {
    if (list) body.push(list.ordered ? "</ol>" : "</ul>");
    list = null;
  };

  for (const block of blocks) {
    if (block.kind !== "list") closeList();
    switch (block.kind) {
      case "heading":
        body.push(`<h${block.level}>${spans(block.spans)}</h${block.level}>`);
        break;
      case "para":
        body.push(`<p>${spans(block.spans)}</p>`);
        break;
      case "quote":
        body.push(`<blockquote>${spans(block.spans)}</blockquote>`);
        break;
      case "list": {
        if (!list || list.ordered !== block.ordered) {
          closeList();
          body.push(block.ordered ? "<ol>" : "<ul>");
          list = { ordered: block.ordered, depth: block.depth };
        }
        const indent = block.depth > 0 ? ' style="margin-left:14pt"' : "";
        body.push(`<li${indent}>${spans(block.spans)}</li>`);
        break;
      }
      case "table":
        body.push(
          "<table><thead><tr>" +
            block.head.map((c) => `<th>${escapeHtml(c)}</th>`).join("") +
            "</tr></thead><tbody>" +
            block.rows
              .map(
                (r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`,
              )
              .join("") +
            "</tbody></table>",
        );
        break;
    }
  }
  closeList();

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; }
  body { font-family: "Noto Sans CJK KR", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif;
         font-size: 10.5pt; line-height: 1.7; color: #111; }
  h1 { font-size: 18pt; margin: 0 0 18pt; }
  h2 { font-size: 13pt; margin: 18pt 0 6pt; border-bottom: 1px solid #ddd; padding-bottom: 4pt; }
  h3 { font-size: 11.5pt; margin: 12pt 0 4pt; }
  p, li { margin: 4pt 0; }
  ul, ol { padding-left: 18pt; }
  blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #fff6e5; border-left: 3px solid #e0a72c; color: #6b4c00; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th, td { border: 1px solid #ccc; padding: 5pt 7pt; text-align: left; }
  th { background: #f4f4f5; }
  code { background: #f4f4f5; padding: 1pt 3pt; border-radius: 3px; }
</style></head><body>${body.join("\n")}</body></html>`;
}

/** 이스케이프가 먼저다. 그 뒤에만 우리가 아는 마크업을 되살린다. */
function spans(items: Inline[]): string {
  return items
    .map((span) => {
      const text = escapeHtml(span.text);
      if (span.href) return `<a href="${escapeHtml(span.href)}">${text}</a>`;
      if (span.code) return `<code>${text}</code>`;
      if (span.bold) return `<strong>${text}</strong>`;
      return text;
    })
    .join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { plain };
