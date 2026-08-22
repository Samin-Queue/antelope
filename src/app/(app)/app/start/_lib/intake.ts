import { z } from "zod";

import { isAbort, runObject } from "@/lib/ai/gateway";

import { discover, type Discovery } from "./discover";
import { drill, urlsIn, type IntakeFile, type Link, type Page } from "./fetch";
import { harvest, INTAKE_BUDGET } from "./harvest";
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
   * 웹 검색으로 공고를 찾아본 결과. 링크·파일이 하나도 없을 때만 돈다.
   *
   * `null` 은 「검색이 필요 없었다」이고, `urls: []` 는 「찾아봤는데 없었다」다.
   * 둘을 구분해야 착수 판정이 사람에게 무엇을 물을지 정할 수 있다 — 검색까지
   * 하고도 못 찾은 것과 애초에 안 찾아본 것은 다른 상황이다.
   */
  discovered: Discovery | null;
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
 * `signal` 은 **단계 상한**이다. `withTimeout` 은 `Promise.race` 라 240초가
 * 지나도 진 쪽이 계속 돌았다 — 상한은 있고 회수가 없었다. 이걸 아래로 흘려야
 * 상한이 실제로 일을 끊는다.
 *
 * ⚠ 사용자가 탭을 닫은 것은 **취소가 아니다.** 준비는 끝까지 가서 세션 행에
 * 쌓이고, 사용자는 「지난 목표」에서 이어 받는다.
 */
export type Ctx = { log: (text: string) => void; signal?: AbortSignal };

/**
 * ⚠ 파일 상한은 여기 없다. `harvest.ts` 의 `HARVEST_BUDGET` 이 개수와 **바이트**를
 * 함께 센다 — 20쪽 공고문 하나가 200KB 서식 열 개보다 비싸고, 개수만 세면 그
 * 차이가 안 보인다. 예전 `MAX_FILES = 6` 이 여기 있어서, 1단계가 상한을 다 쓰면
 * 조사 단계는 아무것도 못 넣었다.
 */
const MAX_URLS = 3;

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

  /**
   * 읽을 것이 하나도 없으면 **찾아본다.**
   *
   * 청사진 [4]의 첫 항목이 웹 검색인데 구현이 빠져 있었다. 그래서 공고 제목만
   * 붙여넣은 입력은 원문 0바이트로 흘러갔고, 그 위에서 만들어진 요약은 모델의
   * 사전지식이었다. 검색을 여기 두는 이유는 요약보다 **앞**이어야 하기
   * 때문이다 — 시드가 없으면 요약할 것이 사용자 문장뿐이다.
   *
   * 검색 대상은 `sourceText`(사용자가 쓴 문장)뿐이다. 링크만 주고 그 링크가
   * 죽은 경우에 URL 문자열을 검색해 봐야 같은 죽은 페이지가 나온다.
   */
  let discovered: Discovery | null = null;
  if (files.length === 0 && pages.length === 0 && sourceText) {
    ctx.log("링크도 파일도 없다 — 공고를 검색한다");
    discovered = await discover(sourceText, ctx);
    for (const url of discovered.urls) {
      try {
        const result = await drill(url, "url");
        if (result.kind === "file") {
          files.push(result.file);
          ctx.log(
            `검색으로 찾은 파일: ${result.file.name} (${formatBytes(result.file.blob.size)})`,
          );
        } else {
          pages.push(result.page);
          ctx.log(
            `검색으로 찾은 페이지: ${result.page.title || url} · 본문 ${result.page.text.length.toLocaleString()}자 · 링크 ${result.page.links.length}개`,
          );
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push({ url, reason });
        ctx.log(`검색 결과 열기 실패: ${url} — ${reason}`);
      }
    }
  }

  /**
   * 페이지에 달린 첨부를 받는다. 공고문 원본은 대개 첨부에 있다.
   *
   * **여기서는 1홉만 판다.** 아직 요약도 없어서 「이 공고가 무엇인지」를 모르고,
   * 그 상태로 상세 페이지까지 열면 무관한 공고를 끌어올 위험이 크다. 2홉은
   * 요약을 손에 쥔 조사 단계(`research`)가 판다.
   */
  const links = pages.flatMap((page) => page.links);
  if (pages.length > 0) {
    const found = await harvest(
      { seeds: pages, intent, have: files, depth: 1, budget: INTAKE_BUDGET },
      ctx,
    );
    files.push(...found.files);
    for (const line of found.skipped) ctx.log(`건너뜀: ${line}`);
  }

  return { intent, files, pages, links, sourceText, discovered, failures };
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
