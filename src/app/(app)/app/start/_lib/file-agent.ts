import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateObject, generateText } from "ai";
import { chromium } from "playwright";
import { z } from "zod";

import type { Ctx } from "./intake";
import { bigModel, clip } from "./llm";
import type { Artifact, Need } from "./types";

/**
 * 파일 에이전트 — 제출용 문서를 만든다.
 *
 * 제출 서류는 두 갈래다. **발급받는 것**(사업자등록증·4대보험 명부·재무제표)은
 * 우리가 만들 수 없다 — 만들면 위조다. **작성하는 것**(사업계획서·자기소개서·
 * 제안서)만 쓴다.
 *
 * 지어내지 않는 것이 이 에이전트의 전부다. 마스터 테이블에 있는 값과 공고
 * 원문만 근거로 쓰고, 모르는 것은 「확인 필요」로 남긴다 — 그럴듯한 숫자를
 * 채워 넣은 사업계획서는 안 낸 것만 못하다.
 *
 * PDF 는 Chromium 으로 찍는다. 새 의존성이 없고, 컨테이너에 `fonts-noto-cjk`
 * 가 있어 한글이 그대로 나온다. hwp·docx 는 아직이다.
 */
const SYSTEM_CHROMIUM = "/usr/bin/chromium";

export type DocumentJob = {
  /** 이 문서가 채우는 마스터 테이블 항목 */
  needKey: string;
  label: string;
  /** 문서 제목 */
  title: string;
  /** 목차. 모델이 공고에서 요구한 것을 보고 정한다 */
  sections: string[];
};

const planSchema = z.object({
  author: z
    .array(
      z.object({
        label: z.string(),
        title: z.string().nullish(),
        sections: z.array(z.string()).nullish(),
      }),
    )
    .nullish(),
  obtain: z.array(z.string()).nullish(),
});

/**
 * 제출 서류를 「쓸 수 있는 것」과 「받아 와야 하는 것」으로 가른다.
 *
 * 이 판단이 틀리면 두 가지로 나빠진다 — 발급 서류를 쓰려 들면 위조가 되고,
 * 작성 서류를 사람에게 미루면 이 제품이 할 일을 안 한 것이 된다.
 */
export async function planDocuments(
  needs: Need[],
  brief: string,
  ctx: Ctx,
): Promise<{ jobs: DocumentJob[]; obtain: string[] }> {
  const files = needs.filter((need) => need.kind === "file");
  if (files.length === 0) return { jobs: [], obtain: [] };

  const { object } = await generateObject({
    model: bigModel(),
    schema: planSchema,
    system: [
      "너는 제출 서류를 두 갈래로 가르는 분류자다. 결과를 아래 JSON 구조 그대로 낸다.",
      `{ "author": [{ "label": string, "title": string, "sections": [string] }], "obtain": [string] }`,
      "",
      "author — 신청자가 **직접 작성하는** 문서. 우리가 초안을 쓸 수 있다.",
      "  사업계획서, 자기소개서, 제안서, 연구계획서, 활동계획서, 에세이, 요약서, 포트폴리오 설명",
      "obtain — 기관에서 **발급받는** 서류. 우리가 만들면 위조다.",
      "  사업자등록증, 4대보험 가입자명부, 재무제표, 등본, 증명서, 통장 사본, 인증서, 납세증명",
      "",
      "- label 은 주어진 서류 이름을 **그대로** 옮긴다. 바꾸지 않는다.",
      "- author 의 sections 는 그 문서에 들어갈 목차다. 공고가 요구한 항목이 있으면 그것을 쓴다. 4~7개.",
      "- 애매하면 obtain 으로 둔다. 발급 서류를 지어내는 것보다 사람에게 맡기는 편이 낫다.",
    ].join("\n"),
    prompt: [
      `제출 서류: ${files.map((need) => need.label).join(", ")}`,
      "",
      "--- 공고 준비 문서 ---",
      clip(brief, 8_000),
    ].join("\n"),
  });

  const byLabel = new Map(files.map((need) => [need.label, need]));
  const jobs: DocumentJob[] = [];
  for (const item of object.author ?? []) {
    const need = byLabel.get(item.label.trim());
    if (!need) continue;
    jobs.push({
      needKey: need.key,
      label: need.label,
      title: item.title?.trim() || need.label,
      sections: (item.sections ?? [])
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 7),
    });
  }
  const obtain = (object.obtain ?? [])
    .map((label) => label.trim())
    .filter((label) => byLabel.has(label));

  ctx.log(`서류 ${files.length}개 — 작성 ${jobs.length} · 발급 ${obtain.length}`);
  return { jobs, obtain };
}

/** 문서 하나를 써서 PDF 로 만든다. */
export async function writeDocument(
  job: DocumentJob,
  context: { title: string; organization: string | null; brief: string; needs: Need[] },
  dir: string,
  ctx: Ctx,
): Promise<Artifact> {
  const known = context.needs.filter(
    (need) => need.value?.trim() && need.kind !== "file",
  );

  const { text } = await generateText({
    model: bigModel(),
    system: [
      `너는 「${job.title}」 를 쓰는 작성자다. 응답은 하나의 완결된 Markdown 문서다.`,
      "인사말·설명·코드 펜스는 쓰지 않는다.",
      "",
      "규칙:",
      "- **주어진 사실과 공고 원문만 근거로 쓴다.** 매출액·인원·기간·수상 이력 같은 수치를 지어내지 않는다.",
      "- 근거가 없는 항목은 `> 확인 필요: (무엇이 필요한지)` 한 줄로 남긴다. 그럴듯하게 메우지 않는다.",
      "- 문서 맨 위에 `# 제목` 을 쓰고, 아래 목차를 `##` 로 순서대로 쓴다.",
      job.sections.length
        ? `- 목차: ${job.sections.join(" / ")}`
        : "- 목차는 공고 요구에 맞게 정한다.",
      "- 한국어로 쓴다. 표가 필요하면 Markdown 표를 쓴다.",
    ].join("\n"),
    prompt: [
      `문서: ${job.label}`,
      `신청 대상: ${context.title}`,
      context.organization ? `주관: ${context.organization}` : "",
      "",
      "신청자 정보 (이 값만 사실이다):",
      ...known.map((need) => `  ${need.label}: ${need.value}`),
      "",
      "--- 공고 준비 문서 ---",
      clip(context.brief, 10_000),
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const markdown = text.trim().replace(/^```(?:markdown)?\n?|\n?```$/g, "");
  const filename = `${safeName(job.title)}.pdf`;
  const path = join(dir, filename);
  await mkdir(dir, { recursive: true });
  const pdf = await renderPdf(markdown, job.title);
  await writeFile(path, pdf);

  ctx.log(`${job.label} 작성 — ${filename} (${(pdf.length / 1024).toFixed(0)}KB)`);
  return {
    needKey: job.needKey,
    label: job.label,
    filename,
    mime: "application/pdf",
    bytes: pdf.length,
    path,
    usedKeys: known.map((need) => need.key),
  };
}

/** 세션마다 따로 둔다. 컨테이너가 재시작하면 사라지고, 그때는 다시 만든다. */
export function artifactDir(runId: string): string {
  return join(tmpdir(), "antelope-artifacts", runId);
}

async function renderPdf(markdown: string, title: string): Promise<Buffer> {
  const executablePath = existsSync(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : undefined;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath
      ? { executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
      : {}),
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html(markdown, title), { waitUntil: "load" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "18mm", right: "18mm" },
    });
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * 최소 Markdown → HTML.
 *
 * 라이브러리를 넣지 않는다 — 입력이 우리 모델의 출력이라 문법 범위가 좁고,
 * 무엇보다 HTML 을 먼저 이스케이프하므로 주입이 생기지 않는다.
 */
function html(markdown: string, title: string): string {
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
</style></head><body>${toHtml(markdown)}</body></html>`;
}

function toHtml(markdown: string): string {
  const out: string[] = [];
  /** 열려 있는 목록 스택. 0 = 최상위 */
  const lists: Array<"ul" | "ol"> = [];
  let table: string[][] | null = null;

  const closeList = (to = 0) => {
    while (lists.length > to) out.push(`</${lists.pop()}>`);
  };
  /** 원하는 깊이·종류의 목록을 연다 */
  const openList = (kind: "ul" | "ol", depth: number) => {
    closeList(depth + 1);
    if (lists.length === depth + 1 && lists[depth] === kind) return;
    if (lists.length === depth + 1) out.push(`</${lists.pop()}>`);
    while (lists.length < depth) {
      out.push("<ul>");
      lists.push("ul");
    }
    out.push(`<${kind}>`);
    lists.push(kind);
  };
  const closeTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    out.push(
      "<table><thead><tr>" +
        head.map((c) => `<th>${inline(c)}</th>`).join("") +
        "</tr></thead><tbody>" +
        rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("") +
        "</tbody></table>",
    );
    table = null;
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    // 들여쓴 목록은 한 단계 아래로 넣는다. 모델이 「핵심 기능 방향」 아래에
    // 항목을 매다는 일이 흔한데, 이걸 안 보면 문단으로 흩어져 읽히지 않는다.
    const depth = /^\s+[-*\d]/.test(raw) ? 1 : 0;

    if (/^\|.*\|$/.test(line.trim())) {
      const cells = line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      // 구분선(|---|---|)은 표의 일부가 아니다
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      closeList();
      (table ??= []).push(cells);
      continue;
    }
    closeTable();

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      closeList();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line.trim());
    if (bullet) {
      openList("ul", depth);
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(line.trim());
    if (numbered) {
      openList("ol", depth);
      out.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }

    closeList();
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  closeTable();
  return out.join("\n");
}

/** 이스케이프가 먼저다. 그 뒤에만 우리가 아는 마크업을 되살린다. */
function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeName(title: string): string {
  return (
    title
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60) || "문서"
  );
}
