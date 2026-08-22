import { z } from "zod";

import { isAbort, runObject } from "@/lib/ai/gateway";

import { drill, urlsIn, type IntakeFile, type Link, type Page } from "./fetch";
import { clip } from "./llm";

/**
 * 1단계 — 입력 정리.
 *
 * 컴포저가 준 것은 파일·링크·문장 중 하나지만 문장 안에 링크가 있을 수 있고,
 * 링크는 파일일 수도 페이지일 수도 있다. 여기서 전부 풀어 「파일 목록 + 페이지
 * 본문 + 링크 후보」 로 만든다. 이후 단계는 입력 종류를 다시 묻지 않는다.
 *
 * 작은 모델이 두 가지를 판단한다 — 문장에서 무엇을 원하는지(intent)와 어느 링크가
 * 공고 첨부인지. 둘 다 정규식만으로는 틀리기 쉬운 일이다.
 */
export type IntakeInput = { text?: string; url?: string; file?: File };

export type Intake = {
  intent: string;
  files: IntakeFile[];
  pages: Page[];
  /** 페이지에서 본 링크 전부. research 가 첨부·신청 URL 후보로 쓴다 */
  links: Link[];
  /** 사용자가 직접 쓴 문장 (링크만 있던 게 아니면) */
  sourceText: string | null;
  /**
   * 가져오지 못한 링크와 이유.
   *
   * 접힌 로그에만 남기면 화면에는 「읽을 수 있는 게 없습니다」만 뜨고 사용자는
   * 아무 일도 안 일어난 것으로 본다. 실패는 이유째로 위로 올린다.
   */
  failures: Array<{ url: string; reason: string }>;
};

/**
 * 단계가 들고 다니는 것.
 *
 * `signal` 이 없던 동안 이 파이프라인에는 **취소가 없었다.** 사용자가 탭을
 * 닫아도 Studio 폴링과 Solar 호출이 끝까지 돌아 그대로 청구됐고,
 * `withTimeout` 은 `Promise.race` 라 240초 뒤에도 진 쪽이 계속 돌았다 —
 * 상한이 있었을 뿐 회수가 없었다.
 */
export type Ctx = { log: (text: string) => void; signal?: AbortSignal };

export const MAX_FILES = 6;
const MAX_URLS = 3;
const MAX_ATTACHMENTS = 3;

export async function intake(input: IntakeInput, ctx: Ctx): Promise<Intake> {
  const failures: Array<{ url: string; reason: string }> = [];
  const files: IntakeFile[] = [];
  const pages: Page[] = [];
  let intent = "";
  let urls: string[] = [];
  let sourceText: string | null = null;

  if (input.file) {
    files.push({ name: input.file.name, blob: input.file, origin: "upload" });
    intent = `파일 「${input.file.name}」 을 읽고 신청을 준비한다`;
    ctx.log(`파일 첨부: ${input.file.name} (${formatBytes(input.file.size)})`);
  }

  if (input.url) {
    urls.push(input.url);
    intent = intent || "링크의 공고를 읽고 신청을 준비한다";
  }

  if (input.text?.trim()) {
    const text = input.text.trim();
    const found = urlsIn(text);
    const onlyUrl = found.length === 1 && text === found[0];
    if (!onlyUrl) sourceText = text;
    const read = await readText(text);
    intent = read.intent || intent || "입력한 내용으로 신청을 준비한다";
    urls = [...new Set([...urls, ...read.urls, ...found])];
    ctx.log(
      `문장 해석: ${intent}` +
        (urls.length ? ` · 링크 ${urls.length}개` : "") +
        (read.mentionsFile ? " · 파일을 언급함" : ""),
    );
  }

  for (const url of urls.slice(0, MAX_URLS)) {
    try {
      const result = await drill(url, "url");
      if (result.kind === "file") {
        files.push(result.file);
        ctx.log(`파일 링크: ${result.file.name} (${formatBytes(result.file.blob.size)})`);
      } else {
        pages.push(result.page);
        ctx.log(
          `페이지: ${result.page.title || url} · 본문 ${result.page.text.length.toLocaleString()}자 · 링크 ${result.page.links.length}개`,
        );
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push({ url, reason });
      ctx.log(`링크 실패: ${url} — ${reason}`);
    }
  }
  if (urls.length > MAX_URLS)
    ctx.log(`링크 ${urls.length - MAX_URLS}개는 건너뜀 (최대 ${MAX_URLS})`);

  // 페이지에 첨부 파일 링크가 있으면 내려받는다. 공고문 원본은 대개 첨부에 있다.
  const links = pages.flatMap((page) => page.links);
  const candidates = links.filter((link) => link.isDocument).slice(0, 40);
  if (candidates.length > 0 && files.length < MAX_FILES) {
    const picked = await pickAttachments(intent, candidates);
    for (const url of picked) {
      if (files.length >= MAX_FILES) break;
      if (files.some((file) => file.url === url)) continue;
      try {
        const result = await drill(url, "url");
        if (result.kind === "file") {
          files.push(result.file);
          ctx.log(`첨부 다운로드: ${result.file.name}`);
        }
      } catch (error) {
        ctx.log(`첨부 실패: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return { intent, files, pages, links, sourceText, failures };
}

const readSchema = z.object({
  intent: z.string().nullish(),
  urls: z.array(z.string()).nullish(),
  mentionsFile: z.boolean().nullish(),
});

/** 문장을 읽는다 — 무엇을 원하고, 어떤 링크가 있고, 파일을 언급하는지 */
async function readText(text: string) {
  try {
    const { value } = await runObject(
      { task: "intake", tier: "small" },
      {
        role: "너는 사용자의 입력을 분류하는 보조자다.",
        schema: readSchema,
        repair: 0,
        rules: [
          "- intent: 사용자가 무엇을 신청·확인하려는지 한 문장. 입력에 없는 내용을 지어내지 않는다.",
          "- urls: 입력 안의 http(s) 링크 전부. 없으면 빈 배열.",
          "- mentionsFile: 첨부·파일·캡쳐 같은 것을 언급하면 true.",
        ],
        prompt: clip(text, 8_000),
        normalize: (raw) => ({
          intent: raw.intent?.trim() ?? "",
          urls: (raw.urls ?? []).filter((url) => /^https?:\/\//i.test(url)),
          mentionsFile: raw.mentionsFile ?? false,
        }),
      },
    );
    return value;
  } catch (error) {
    if (isAbort(error)) throw error;
    // 해석이 실패해도 정규식 링크로는 계속 간다.
    return { intent: "", urls: [], mentionsFile: false };
  }
}

const pickSchema = z.object({ urls: z.array(z.string()).nullish() });

/** 어느 링크가 공고 첨부인지. 게시판의 「이전 글」「개인정보처리방침」 까지 받으면 안 된다 */
async function pickAttachments(intent: string, candidates: Link[]): Promise<string[]> {
  try {
    const { value: object } = await runObject(
      { task: "intake", tier: "small" },
      {
        role: "너는 공고 페이지의 링크 목록에서 공고문·신청 양식 첨부 파일만 고르는 보조자다.",
        schema: pickSchema,
        repair: 0,
        rules: [
          `- 목표와 관련된 공고문·모집요강·신청서 양식·제출 서식만 고른다. 최대 ${MAX_ATTACHMENTS}개.`,
          "- 개인정보처리방침, 사이트맵, 다른 공고, 이미지 배너는 고르지 않는다.",
          "- 확신이 없으면 비운다.",
        ],
        prompt: [
          `목표: ${intent}`,
          "",
          "링크 목록:",
          ...candidates.map(
            (link, i) => `${i + 1}. ${link.text || "(글자 없음)"} — ${link.url}`,
          ),
        ].join("\n"),
      },
    );
    const allowed = new Set(candidates.map((link) => link.url));
    return (object.urls ?? [])
      .filter((url) => allowed.has(url))
      .slice(0, MAX_ATTACHMENTS);
  } catch (error) {
    if (isAbort(error)) throw error;
    // 모델이 실패하면 확장자가 문서인 링크만 앞에서부터 집는다.
    return candidates
      .filter((link) => /\.(pdf|hwpx?|docx?)(\?|#|$)/i.test(link.url))
      .slice(0, MAX_ATTACHMENTS)
      .map((link) => link.url);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
