import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { z } from "zod";

import { runObject, runText } from "@/lib/ai/gateway";
import { obtainOnly } from "@/lib/ai/verify";
import { recallNarratives } from "@/app/(labs)/lab/notice/_lib/memory";

import { documentBytes, documentKey, recallDocuments } from "./documents";
import type { IntakeFile } from "./fetch";
import type { Ctx } from "./intake";
import { clip } from "./llm";
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

  const { value: object } = await runObject(
    { task: "documents", log: ctx.log, signal: ctx.signal },
    {
      role: "너는 제출 서류를 두 갈래로 가르는 분류자다.",
      schema: planSchema,
      rules: [
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
      ],
      /**
       * **위조를 막는 자리다.** 발급 서류를 author 로 잘못 넣으면 우리가
       * 사업자등록증을 「써 준다」. 그건 값 하나 틀린 것과 급이 다르므로
       * `reject` 로 두고 한 번 되묻는다.
       */
      verify: [obtainOnly("author[].label")],
      prompt: [
        `제출 서류: ${files.map((need) => need.label).join(", ")}`,
        "",
        "--- 공고 준비 문서 ---",
        clip(brief, 8_000),
      ].join("\n"),
    },
  );

  // 정확 일치로 잡으면 모델이 라벨을 조금만 다듬어도 통째로 빠진다 — 실측에서
  // 「작성 0 · 발급 3」 이 나왔고, 사업계획서가 목록에서 사라졌다.
  // 서류 이름 정규화(「사본·1부·서류」 제거)로 맞춘다.
  // ⚠ 빈 키는 **와일드카드가 된다.** `documentKey("제출 서류")` 는 NOISE 가
  // 「제출」·「서류」를 다 털어내 `""` 이고, 아래 `key.includes(item.key)` 는
  // 빈 문자열에 대해 항상 참이다 — 실측: `pick("사업계획서")` 가 정확일치에
  // 실패하면 「제출 서류」를 돌려줬다. 후보 쪽에서 미리 거른다.
  const keyed = files
    .map((need) => ({ need, key: documentKey(need.label) }))
    .filter((item) => item.key);
  const pick = (label: string): Need | undefined => {
    const key = documentKey(label);
    if (!key) return undefined;
    // 「사업계획서(지정양식 별지 제1호)」 를 모델이 「사업계획서」 로 부르는 일이
    // 흔하다. 정확 일치 → 한쪽이 다른 쪽을 품는 관계 순으로 찾는다.
    return (
      keyed.find((item) => item.key === key)?.need ??
      keyed.find((item) => item.key.includes(key) || key.includes(item.key))?.need
    );
  };

  const jobs: DocumentJob[] = [];
  for (const item of object.author ?? []) {
    const need = pick(item.label);
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
  const authored = new Set(jobs.map((job) => job.needKey));
  const obtain = (object.obtain ?? [])
    .map((label) => pick(label))
    .filter((need): need is Need => Boolean(need) && !authored.has(need!.key))
    .map((need) => need.label);

  // 모델이 어느 쪽에도 넣지 않은 서류가 생긴다. 버리지 않고 발급으로 돌린다 —
  // 사람에게 묻는 편이 조용히 사라지는 것보다 낫다.
  const seen = new Set([...authored, ...obtain.map((label) => documentKey(label))]);
  const missed = files.filter(
    (need) => !authored.has(need.key) && !seen.has(documentKey(need.label)),
  );
  if (missed.length > 0) {
    ctx.log(`분류에서 빠진 서류 ${missed.length}개는 발급으로 돌린다`);
    obtain.push(...missed.map((need) => need.label));
  }

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
  context: {
    title: string;
    organization: string | null;
    brief: string;
    needs: Need[];
    userId?: string | null;
  },
  dir: string,
  ctx: Ctx,
): Promise<{ artifact: Artifact; markdown: string }> {
  const known = context.needs.filter(
    (need) => need.value?.trim() && need.kind !== "file",
  );

  /**
   * 서술형 기억.
   *
   * 마스터 테이블은 「상시근로자 수: 12」 같은 값만 담는다. 사업계획서가 필요한
   * 것은 그런 값이 아니라 「무엇을 해왔는가」다 — 그건 `memories.embedding`
   * (서술 검색용 벡터)에 있고, 여기서 꺼내지 않으면 그 벡터는 쓰이지 않는다.
   */
  const recalled = context.userId
    ? await recallNarratives(
        context.userId,
        [job.title, ...job.sections].join(" "),
        5,
      ).catch(() => [])
    : [];
  if (recalled.length) ctx.log(`서술형 기억 ${recalled.length}개를 근거로 쓴다`);

  const text = await runText(
    // 사람이 당장 안 보는 일이다. 사람이 기다리는 호출과 레인을 나눈다.
    { task: "documents", lane: "batch", signal: ctx.signal },
    {
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
        recalled.length ? "" : null,
        recalled.length
          ? "지난 신청에서 사용자가 쓴 서술 (그대로 인용하지 말고 근거로 쓴다):"
          : "",
        ...recalled.map((item) => `  ${item.label}: ${item.value}`),
        "",
        "--- 공고 준비 문서 ---",
        clip(context.brief, 10_000),
      ]
        .filter(Boolean)
        .join("\n"),
    },
  );

  const markdown = text.trim().replace(/^```(?:markdown)?\n?|\n?```$/g, "");
  const blocks = parseBlocks(markdown);
  const filename = `${safeName(job.title)}.${job.format}`;
  const path = join(dir, filename);
  await mkdir(dir, { recursive: true });
  const bytes = await render(blocks, job, ctx);
  await writeFile(path, bytes);

  ctx.log(`${job.label} 작성 — ${filename} (${(bytes.length / 1024).toFixed(0)}KB)`);
  return {
    artifact: {
      needKey: job.needKey,
      label: job.label,
      filename,
      mime: MIME[job.format],
      bytes: bytes.length,
      path,
      usedKeys: known.map((need) => need.key),
      from: "agent",
    },
    markdown,
  };
}

/**
 * 같은 문서의 PDF 사본.
 *
 * 신청 페이지가 어떤 형식을 받는지는 **준비 단계에서 알 수 없다.** 실측:
 * 공고문에 「지정양식」이 있어 hwp 로 만들었는데 정작 업로드 칸은 `.pdf` 만
 * 받았고, 브라우저가 조용히 무시해 제출에서 막혔다.
 *
 * PDF 는 가장 널리 받는 형식이라 한 벌 더 두면 그 실패가 사라진다. 본문이
 * 같으므로 내용이 갈릴 일도 없다.
 */
export async function pdfCopy(
  original: Artifact,
  markdown: string,
  title: string,
  dir: string,
  ctx: Ctx,
): Promise<Artifact | null> {
  if (original.mime === MIME.pdf) return null;
  try {
    const filename = `${safeName(title)}.pdf`;
    const path = join(dir, filename);
    const bytes = await renderPdf(parseBlocks(markdown), title);
    await writeFile(path, bytes);
    ctx.log(`${original.label} PDF 사본 — ${filename}`);
    return {
      ...original,
      needKey: `${original.needKey}-pdf`,
      filename,
      mime: MIME.pdf,
      bytes: bytes.length,
      path,
    };
  } catch (error) {
    ctx.log(`PDF 사본 실패: ${error instanceof Error ? error.message : error}`);
    return null;
  }
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

  /**
   * 채운 서식을 **어느 업로드 칸에 넣을지** 찾는다.
   *
   * 예전에는 `needKey` 가 `template-<파일명>` 이라 마스터 테이블의 어느 항목과도
   * 이어지지 않았다 — 브라우저는 그 파일을 들고 있으면서도 「이 칸에 넣을 것」을
   * 알 수 없었다. 공고가 준 `formName` 이 그 답이고, 그 값은 Studio 가 이미
   * 내주고 있었다(우리 스키마가 버렸을 뿐이다). 없으면 서류 이름으로 맞춘다.
   */
  const slots = needs.filter((need) => need.kind === "file");
  const slotFor = (filename: string): Need | undefined => {
    const named = slots.find(
      (need) => need.formName && documentKey(need.formName) === documentKey(filename),
    );
    if (named) return named;
    const key = documentKey(filename.replace(/\.(hwpx?)$/i, ""));
    if (!key) return undefined;
    return slots.find(
      (need) =>
        documentKey(need.label) &&
        (documentKey(need.label).includes(key) || key.includes(documentKey(need.label))),
    );
  };

  for (const template of templates) {
    const format: HwpFormat = /\.hwpx$/i.test(template.name) ? "hwpx" : "hwp";
    const source = artifactPath(dir, `template-${template.name}`);
    try {
      await writeFile(source, Buffer.from(await template.blob.arrayBuffer()));
      const result = await fillHwp(source, format, values);
      if (result.filled.length === 0) {
        ctx.log(`${template.name}: 채울 칸을 못 찾음 — 서식이 아닌 듯하다`);
        continue;
      }
      const filename = safeName(`작성_${template.name}`);
      const path = artifactPath(dir, filename);
      await writeFile(path, result.bytes);
      ctx.log(
        `${template.name} 서식에 ${result.filled.length}칸 채움` +
          (result.skipped.length ? ` · 자리 없음 ${result.skipped.length}` : ""),
      );
      const slot = slotFor(template.name);
      if (slot) ctx.log(`${template.name} → 「${slot.label}」 칸에 붙인다`);
      out.push({
        needKey: slot?.key ?? `template-${template.name}`,
        label: slot ? `${slot.label} (지정 서식)` : `${template.name} (지정 서식)`,
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
    const path = artifactPath(dir, file.filename);
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
/** 이번 실행의 파일이 모이는 곳. 여기 밖으로는 한 글자도 못 나간다 */
export const ARTIFACT_ROOT = join(tmpdir(), "antelope-artifacts");

/**
 * `runId` 는 요청 본문·폼 필드로 들어온다 — 즉 **클라이언트가 정한다.**
 * 그대로 `join` 하면 `../../` 하나로 컨테이너 아무 데나 쓸 수 있다.
 * 위생 처리 후 결과가 루트 안인지 다시 확인한다. 검사에 실패하면 던진다 —
 * 조용히 다른 곳에 쓰는 것보다 낫다.
 */
export function artifactDir(runId: string): string {
  const dir = join(ARTIFACT_ROOT, safeName(runId));
  if (relative(ARTIFACT_ROOT, dir).startsWith("..") || !dir.startsWith(ARTIFACT_ROOT)) {
    throw new Error(`[artifacts] 잘못된 runId: ${runId.slice(0, 40)}`);
  }
  void sweepArtifacts();
  return dir;
}

/**
 * 남은 실행 디렉터리를 치운다.
 *
 * 정상 경로는 신청이 끝나면 자기 것을 지우지만, 준비만 하고 떠난 실행·재시작
 * 중에 끊긴 실행은 아무도 안 지운다. 상시 컨테이너라 그게 그대로 쌓인다.
 * 요청마다 돌 필요는 없어 한 시간에 한 번으로 묶는다.
 */
const SWEEP_EVERY_MS = 60 * 60 * 1000;
const KEEP_MS = 24 * 60 * 60 * 1000;
let sweptAt = 0;

export async function sweepArtifacts(now = Date.now()): Promise<number> {
  if (now - sweptAt < SWEEP_EVERY_MS) return 0;
  sweptAt = now;
  let removed = 0;
  try {
    for (const name of await readdir(ARTIFACT_ROOT)) {
      const dir = join(ARTIFACT_ROOT, name);
      try {
        const info = await stat(dir);
        if (now - info.mtimeMs < KEEP_MS) continue;
        await rm(dir, { recursive: true, force: true });
        removed += 1;
      } catch {
        /* 다른 요청이 방금 지웠을 수 있다 */
      }
    }
  } catch {
    /* 아직 루트가 없다 */
  }
  return removed;
}

/**
 * 이 디렉터리 안의 파일 하나를 가리키는 경로.
 *
 * 파일명도 사용자가 정한다(업로드 파일명·모델이 지은 제목). 같은 이유로
 * 위생 처리하고, 확장자만 살려 둔다.
 */
export function artifactPath(dir: string, filename: string): string {
  const ext = (filename.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? "").toLowerCase();
  const base = safeName(filename.slice(0, filename.length - ext.length));
  const path = join(dir, `${base}${ext}`);
  if (relative(dir, path).startsWith("..") || !path.startsWith(dir)) {
    throw new Error(`[artifacts] 잘못된 파일명: ${filename.slice(0, 60)}`);
  }
  return path;
}

export function safeName(title: string): string {
  return (
    title
      // 경로 구분자와 상위 이동을 먼저 없앤다. 그 뒤에야 나머지를 다듬는다.
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\.{2,}/g, ".")
      .replace(/^\.+/, "")
      .replace(/\s+/g, "_")
      .slice(0, 60) || "문서"
  );
}
