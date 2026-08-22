import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateObject, generateText } from "ai";
import { chromium } from "playwright";
import { z } from "zod";

import { documentBytes, recallDocuments } from "./documents";
import type { IntakeFile } from "./fetch";
import type { Ctx } from "./intake";
import { bigModel, clip } from "./llm";
import { parseBlocks } from "./render/blocks";
import { renderDocx } from "./render/docx";
import { fillHwp, renderHwp, type HwpFormat } from "./render/hwp";
import { renderPdf } from "./render/pdf";
import { renderXlsx } from "./render/xlsx";
import type { Artifact, DocFormat, Need } from "./types";

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
 * 포맷은 공고가 정한다 — 「HWP 양식」이라 적혀 있으면 hwp 로 낸다. 본문은
 * Markdown 으로 한 번만 쓰고, 렌더러가 각자 옮긴다(`render/`).
 */
const FORMATS: DocFormat[] = ["pdf", "hwp", "hwpx", "docx", "xlsx"];

const MIME: Record<DocFormat, string> = {
  pdf: "application/pdf",
  hwp: "application/x-hwp",
  hwpx: "application/hwp+zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export type DocumentJob = {
  /** 이 문서가 채우는 마스터 테이블 항목 */
  needKey: string;
  label: string;
  /** 문서 제목 */
  title: string;
  /** 목차. 모델이 공고에서 요구한 것을 보고 정한다 */
  sections: string[];
  /** 공고가 요구한 파일 형식. 알 수 없으면 pdf */
  format: DocFormat;
};

const planSchema = z.object({
  author: z
    .array(
      z.object({
        label: z.string(),
        title: z.string().nullish(),
        sections: z.array(z.string()).nullish(),
        format: z.string().nullish(),
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
      `{ "author": [{ "label": string, "title": string, "sections": [string], "format": "pdf"|"hwp"|"hwpx"|"docx"|"xlsx" }], "obtain": [string] }`,
      "",
      "author — 신청자가 **직접 작성하는** 문서. 우리가 초안을 쓸 수 있다.",
      "  사업계획서, 자기소개서, 제안서, 연구계획서, 활동계획서, 에세이, 요약서, 포트폴리오 설명",
      "obtain — 기관에서 **발급받는** 서류. 우리가 만들면 위조다.",
      "  사업자등록증, 4대보험 가입자명부, 재무제표, 등본, 증명서, 통장 사본, 인증서, 납세증명",
      "",
      "- label 은 주어진 서류 이름을 **그대로** 옮긴다. 바꾸지 않는다.",
      "- author 의 sections 는 그 문서에 들어갈 목차다. 공고가 요구한 항목이 있으면 그것을 쓴다. 4~7개.",
      "- format 은 **공고가 요구한 파일 형식**이다. 「HWP 양식」·「아래아한글」이면 hwp,",
      "  「한글 문서(.hwpx)」면 hwpx, 「워드」면 docx, 「엑셀 서식」·「내역서(xls)」면 xlsx.",
      "  형식을 안 밝혔으면 pdf 로 둔다. 예산 내역·인력 현황처럼 표가 본체인 문서는 xlsx 가 낫다.",
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
    const format = (item.format?.trim().toLowerCase() ?? "") as DocFormat;
    jobs.push({
      needKey: need.key,
      label: need.label,
      title: item.title?.trim() || need.label,
      sections: (item.sections ?? [])
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 7),
      format: FORMATS.includes(format) ? format : "pdf",
    });
  }
  const obtain = (object.obtain ?? [])
    .map((label) => label.trim())
    .filter((label) => byLabel.has(label));

  ctx.log(
    `서류 ${files.length}개 — 작성 ${jobs.length}` +
      (jobs.length ? ` (${jobs.map((job) => job.format).join(", ")})` : "") +
      ` · 발급 ${obtain.length}`,
  );
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
  const blocks = parseBlocks(markdown);
  const filename = `${safeName(job.title)}.${job.format}`;
  const path = join(dir, filename);
  await mkdir(dir, { recursive: true });
  const bytes = await render(blocks, job, ctx);
  await writeFile(path, bytes);

  ctx.log(`${job.label} 작성 — ${filename} (${(bytes.length / 1024).toFixed(0)}KB)`);
  return {
    needKey: job.needKey,
    label: job.label,
    filename,
    mime: MIME[job.format],
    bytes: bytes.length,
    path,
    usedKeys: known.map((need) => need.key),
    from: "agent",
  };
}

/**
 * 포맷별 렌더러.
 *
 * hwp 는 WASM 이라 컨테이너에서 실패할 여지가 있다. 그때 문서를 통째로 잃는
 * 것보다 PDF 로라도 내는 편이 낫다 — 내용은 같다.
 */
async function render(
  blocks: ReturnType<typeof parseBlocks>,
  job: DocumentJob,
  ctx: Ctx,
): Promise<Buffer> {
  try {
    switch (job.format) {
      case "hwp":
      case "hwpx":
        return await renderHwp(blocks, job.format);
      case "docx":
        return await renderDocx(blocks, job.title);
      case "xlsx":
        return await renderXlsx(blocks, job.title);
      default:
        return await renderPdf(blocks, job.title);
    }
  } catch (error) {
    if (job.format === "pdf") throw error;
    ctx.log(
      `${job.format} 생성 실패 — PDF 로 대체: ${error instanceof Error ? error.message : error}`,
    );
    job.format = "pdf";
    return renderPdf(blocks, job.title);
  }
}

/**
 * 공고가 준 **지정 서식**을 채운다.
 *
 * 새 문서를 쓰는 것과 다르다 — 기관은 제 서식으로 받기를 원하고, 우리가 새로
 * 만든 문서는 접수처에서 반려된다. 첨부 중 hwp·hwpx 를 열어 표의 라벨 셀을
 * 찾고, 마스터 테이블 값을 같은 행 빈칸에 넣는다.
 *
 * 채운 칸이 하나도 없으면 서식이 아니었던 것이다 — 결과를 버린다.
 */
export async function fillTemplates(
  files: IntakeFile[],
  needs: Need[],
  dir: string,
  ctx: Ctx,
): Promise<Artifact[]> {
  const templates = files.filter((file) => /\.(hwpx?)$/i.test(file.name));
  if (templates.length === 0) return [];

  const values: Record<string, string> = {};
  for (const need of needs) {
    if (need.kind !== "file" && need.value?.trim())
      values[need.label] = need.value.trim();
  }
  if (Object.keys(values).length === 0) return [];

  await mkdir(dir, { recursive: true });
  const out: Artifact[] = [];

  for (const template of templates) {
    const format: HwpFormat = /\.hwpx$/i.test(template.name) ? "hwpx" : "hwp";
    const source = join(dir, `template-${template.name}`);
    try {
      await writeFile(source, Buffer.from(await template.blob.arrayBuffer()));
      const result = await fillHwp(source, format, values);
      if (result.filled.length === 0) {
        ctx.log(`${template.name}: 채울 칸을 못 찾음 — 서식이 아닌 듯하다`);
        continue;
      }
      const filename = `작성_${template.name}`;
      const path = join(dir, filename);
      await writeFile(path, result.bytes);
      ctx.log(
        `${template.name} 서식에 ${result.filled.length}칸 채움` +
          (result.skipped.length ? ` · 자리 없음 ${result.skipped.length}` : ""),
      );
      out.push({
        needKey: `template-${template.name}`,
        label: `${template.name} (지정 서식)`,
        filename,
        mime: MIME[format],
        bytes: result.bytes.length,
        path,
        usedKeys: result.filled.map((item) => item.label),
        from: "agent",
      });
    } catch (error) {
      ctx.log(
        `${template.name} 서식 채우기 실패: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
  return out;
}

/**
 * 보관함에 이미 있는 발급 서류를 꺼내 놓는다.
 *
 * 사업자등록증·4대보험 명부는 공고마다 같은 것을 낸다. 지난번에 올린 것을
 * 다시 달라고 하면 이 제품이 파는 「다시 묻지 않는다」가 값에만 해당하는
 * 셈이 된다.
 */
export async function recallArtifacts(
  labels: string[],
  userId: string | null,
  dir: string,
  ctx: Ctx,
): Promise<Artifact[]> {
  if (!userId || labels.length === 0) return [];
  const found = await recallDocuments(userId, labels);
  const hits = Object.entries(found);
  if (hits.length === 0) {
    ctx.log(`보관함에 없음 — ${labels.join(", ")}`);
    return [];
  }

  await mkdir(dir, { recursive: true });
  const out: Artifact[] = [];
  for (const [label, stored] of hits) {
    const file = await documentBytes(userId, stored.id);
    if (!file) continue;
    const path = join(dir, file.filename);
    await writeFile(path, file.data);
    out.push({
      needKey: documentKeyOf(label),
      label,
      filename: file.filename,
      mime: file.mime,
      bytes: file.data.length,
      path,
      usedKeys: [],
      from: "memory",
    });
  }
  ctx.log(`보관함에서 ${out.map((a) => a.label).join(", ")} 를 꺼냈다`);
  return out;
}

/** needs 의 key 는 `normalizeKey(label)` 이다. 여기서도 같은 규칙을 쓴다. */
function documentKeyOf(label: string): string {
  return label
    .toLowerCase()
    .replace(/[\s\-_·.,:()（）*※]/g, "")
    .replace(/필수|선택/g, "")
    .trim();
}

/** 세션마다 따로 둔다. 컨테이너가 재시작하면 사라지고, 그때는 다시 만든다. */
export function artifactDir(runId: string): string {
  return join(tmpdir(), "antelope-artifacts", runId);
}

function safeName(title: string): string {
  return (
    title
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60) || "문서"
  );
}
