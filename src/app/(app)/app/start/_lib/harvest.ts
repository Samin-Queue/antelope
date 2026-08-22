import { createHash } from "node:crypto";
import { z } from "zod";

import { isAbort, runObject } from "@/lib/ai/gateway";
import { lanes } from "@/lib/ai/lanes";

import { drill, type IntakeFile, type Link, type Page } from "./fetch";
import type { Ctx } from "./intake";

/**
 * 자료 수집 — **한 자리에서** 판다.
 *
 * 이 제품이 증명하려는 것은 「사용자가 링크 하나만 던져도 에이전트가 공고문·
 * 모집요강·서식을 스스로 찾아 Studio 에 태운다」이다. 그러려면 수집이
 * 프롬프트 한 줄이 아니라 예산·게이트·중복 제거가 있는 단계여야 한다.
 *
 * 예전에는 두 군데로 갈려 있었다 — `intake` 가 시드 페이지의 첨부를 3개까지
 * 받고, `research` 가 요약을 보고 또 3개를 받았다. 둘 다 **1홉**이라, 사용자가
 * 던진 링크가 게시판 목록이면 첨부가 0개로 끝났다. 그리고 `intake` 가 상한
 * (6개)을 먼저 채우면 `research` 는 아무것도 못 넣었다.
 *
 * ## 왜 2홉인가
 *
 * 1홉이면 목록 페이지에서 끝난다. 3홉이면 게시판 사이트 전체다 — 무관한 공고가
 * 섞이는 순간 Studio 의 classify 가 흔들리고, 그때 나오는 「필드 목록」은 두 공고가
 * 섞인 것이라 사람이 봐도 못 고친다. 목록 → 상세 → 첨부가 한국 공고 사이트의
 * 실제 깊이다.
 *
 * ## 무엇으로 무관한 것을 막는가
 *
 * 모델 판단 **위에** 코드 규칙을 얹는다. 「확신 없으면 비운다」는 프롬프트 한
 * 줄로는 개인정보처리방침·다른 공고·배너를 못 막는다.
 *
 * - 페이지를 더 열지 말지는 **호스트**로 건다. 시드와 다른 사이트로 넘어가면
 *   거기서부터는 남의 공고다.
 * - 문서 링크는 호스트를 안 본다. 첨부는 CDN·파일 서버로 빠지는 것이 정상이고,
 *   그 링크가 실린 페이지가 이미 관련성 검사를 통과했다.
 * - 잡음은 글자로 먼저 턴다(`NOISE`). 모델을 부르기 전에 후보를 줄이면 정확도와
 *   비용이 같이 좋아진다.
 */
export type Harvest = {
  files: IntakeFile[];
  /** 2홉째에 새로 연 페이지. 요약이 이 본문도 읽는다 */
  pages: Page[];
  /** 무엇을 왜 버렸는지. 화면 진단에 그대로 나간다 */
  skipped: string[];
};

/**
 * 예산 — **개수가 아니라 바이트가 진짜 제약이다.**
 *
 * Document Parse 는 페이지 과금이고 페이지 수는 대체로 바이트에 비례한다.
 * 20쪽 공고문 하나가 200KB 짜리 서식 열 개보다 비싸다. 개수 상한만 두면
 * 그 차이를 못 본다.
 *
 * Studio 는 수백 쪽을 한 job 에 받는다 — 상한이 작을 이유가 없다. 예전 6개는
 * 「우리가 못 태울까 봐」 걸어 둔 값이었지 상류 제약이 아니었다.
 */
export type Budget = { files: number; bytes: number; pages: number };

/**
 * 조사 단계의 예산. Studio 한 job 에 넣을 최종 총량이다.
 *
 * Studio 는 수백 쪽을 한 job 에 받는다 — 상한이 작을 이유가 없다. 예전 6개는
 * 「우리가 못 태울까 봐」 걸어 둔 값이었지 상류 제약이 아니었다.
 */
export const HARVEST_BUDGET: Budget = {
  files: 24,
  bytes: 80 * 1024 * 1024,
  pages: 8,
};

/**
 * 1단계(입력 정리)의 예산 — **일부러 작다.**
 *
 * 여기서 받은 파일은 요약 단계가 **파일마다 Studio job 을 하나씩** 돌린다.
 * 스물네 개를 받아 오면 요약이 job 스물네 개가 되어 단계 상한에 걸려 죽고,
 * 그러면 조사 단계까지 못 간다. 이 단계가 할 일은 「읽을 만한 공고인가」를
 * 판정할 만큼만 모으는 것이고, 대량 수집은 요약을 통과한 뒤 조사 단계가 한다.
 */
export const INTAKE_BUDGET: Budget = {
  files: 6,
  bytes: 20 * 1024 * 1024,
  pages: 0,
};

/** 어느 공고 사이트에나 있는, 이 공고와 무관한 것들 */
const NOISE =
  /개인정보|처리방침|이용약관|저작권|사이트맵|찾아오시는|로그인|회원가입|검색|이전\s*글|다음\s*글|목록으로|팝업|배너|rss|privacy|terms|sitemap|login|signup/i;

/** 이 링크가 「이 공고의 상세」로 보이는가 — 2홉째를 열 후보 */
const DETAIL_HINT =
  /공고|모집|신청|접수|지원|사업|안내|상세|view|detail|read|board|bbs|notice|article/i;

export async function harvest(
  opts: {
    /** 이미 읽은 페이지들. 여기 실린 링크가 후보다 */
    seeds: Page[];
    /** 사용자가 무엇을 하려는지. 모델이 관련성을 판단하는 기준 */
    intent: string;
    /** 이미 갖고 있는 파일. 중복을 여기까지 포함해 센다 */
    have: IntakeFile[];
    /** 2홉을 팔 것인가. 요약 전(intake)에는 1홉, 조사 단계에서 2홉 */
    depth: 1 | 2;
    /** 개수·바이트·상세 페이지 상한 */
    budget: Budget;
  },
  ctx: Ctx,
): Promise<Harvest> {
  const files: IntakeFile[] = [];
  const pages: Page[] = [];
  const skipped: string[] = [];

  /**
   * 중복은 **바이트로** 센다.
   *
   * 같은 공고문이 `/download?fileId=91` 과 `/upload/2026/공고문.pdf` 로 두 번
   * 링크된 사이트가 흔하다. URL 도 이름도 다르지만 같은 파일이고, 두 번 태우면
   * Document Parse 를 두 번 낸다. 이미 갖고 있는 것까지 미리 넣어 둔다.
   */
  const seenBytes = new Set(
    await Promise.all(opts.have.map((file) => digest(file.blob))),
  );
  const seenUrls = new Set(
    opts.have.map((file) => file.url).filter((url): url is string => Boolean(url)),
  );
  let bytes = opts.have.reduce((sum, file) => sum + file.blob.size, 0);

  /**
   * 시도 횟수도 예산이다.
   *
   * 개수·바이트만 세면 **죽은 링크가 공짜로 보인다.** 받은 게 없으니 예산이
   * 안 줄고, 그 사이 `drill` 은 링크마다 15초씩 기다린다 — 상세 페이지 여덟 개에
   * 각각 죽은 첨부가 여덟 개면 그것만으로 16분이고, 조사 단계 상한이 먼저 끊는다.
   */
  let tries = 0;
  const MAX_TRIES = 48;

  const room = () =>
    tries < MAX_TRIES &&
    opts.have.length + files.length < opts.budget.files &&
    bytes < opts.budget.bytes;

  /** 한 페이지에서 문서 링크를 받는다. 받은 것만 돌려준다 */
  const take = async (candidates: Link[], from: string) => {
    for (const link of candidates) {
      if (!room()) {
        skipped.push(`예산 도달 — ${link.url} 이후 건너뜀`);
        return;
      }
      if (seenUrls.has(link.url)) continue;
      seenUrls.add(link.url);
      tries += 1;
      try {
        const result = await drill(link.url, "crawl");
        if (result.kind !== "file") {
          skipped.push(`${link.url} — 파일이 아니라 페이지였다`);
          continue;
        }
        const hash = await digest(result.file.blob);
        if (seenBytes.has(hash)) {
          // 같은 내용을 두 번 태우지 않는다. 「무엇을 아꼈는지」가 보여야
          // 이 검사가 도는지 알 수 있다.
          skipped.push(`${result.file.name} — 이미 받은 것과 같은 파일`);
          continue;
        }
        seenBytes.add(hash);
        bytes += result.file.blob.size;
        files.push(result.file);
        ctx.log(
          `자료 확보: ${result.file.name} (${kb(result.file.blob.size)}) ← ${from}`,
        );
      } catch (error) {
        skipped.push(`${link.url} — ${message(error)}`);
      }
    }
  };

  // 1홉 — 시드 페이지에 직접 달린 문서.
  const seedDocs = await choose(
    opts.seeds.flatMap((page) => page.links).filter(isDocumentCandidate),
    opts.intent,
    "이 공고의 공고문·모집요강·신청 서식",
    ctx,
  );
  ctx.log(`1홉 문서 후보 ${seedDocs.length}개`);
  await take(seedDocs, "시드 페이지");

  if (opts.depth === 1 || !room()) {
    return { files, pages, skipped };
  }

  /**
   * 2홉 — 상세 페이지를 연다.
   *
   * **호스트를 건다.** 시드와 다른 사이트로 넘어가면 거기서부터는 남의 공고이고,
   * 그것이 Studio 에 섞이면 분류가 두 공고 사이에서 흔들린다. 문서 링크와 달리
   * 페이지는 관련성을 스스로 증명하지 못한다.
   */
  const hosts = new Set(opts.seeds.map((page) => host(page.url)).filter(Boolean));
  const seedUrls = new Set(opts.seeds.map((page) => page.url));
  const detail = opts.seeds
    .flatMap((page) => page.links)
    .filter((link) => isDetailCandidate(link, { hosts, seedUrls }));

  const picked = await choose(
    detail,
    opts.intent,
    "이 공고의 상세·모집 안내 페이지 (다른 공고나 목록 페이지가 아닌 것)",
    ctx,
  );
  const toOpen = picked.slice(0, opts.budget.pages);
  if (detail.length > toOpen.length) {
    skipped.push(`상세 후보 ${detail.length}개 중 ${toOpen.length}개만 열었다`);
  }
  ctx.log(`2홉 상세 후보 ${detail.length}개 → ${toOpen.length}개 연다`);

  /**
   * 나란히 연다. 상세 페이지 여덟 개를 직렬로 열면 15초 타임아웃이 여덟 번
   * 겹쳐 조사 단계 상한(240초)을 혼자 다 쓴다. 상한은 레인이 건다.
   */
  const opened = await Promise.all(
    toOpen.map((link) =>
      lanes.batch(async () => {
        try {
          const result = await drill(link.url, "crawl");
          return result.kind === "page" ? result.page : null;
        } catch (error) {
          skipped.push(`${link.url} — ${message(error)}`);
          return null;
        }
      }),
    ),
  );

  for (const page of opened) {
    if (!page) continue;
    pages.push(page);
    ctx.log(`상세 페이지: ${page.title || page.url} · 링크 ${page.links.length}개`);
    if (!room()) break;
    // 상세 페이지 안의 첨부는 **모델을 다시 안 부른다.** 그 페이지 자체가 이미
    // 관련성 검사를 통과했고, 문서 링크는 글자 규칙만으로 충분히 갈린다.
    await take(
      page.links.filter(isDocumentCandidate).slice(0, 8),
      page.title || page.url,
    );
  }

  return { files, pages, skipped };
}

/** 첨부처럼 보이는가. 잡음은 여기서 먼저 턴다 — 모델을 부르기 전에 줄인다 */
export function isDocumentCandidate(link: Link): boolean {
  return link.isDocument && !NOISE.test(link.text) && !NOISE.test(link.url);
}

const pickSchema = z.object({ urls: z.array(z.string()).nullish() });

/**
 * 후보에서 **관련 있는 것만** 고른다.
 *
 * 상한을 안 준다. 모델에게 「3개까지」라고 말하면 열 개가 다 관련 있어도 세 개만
 * 온다 — 그게 예전 `pickAttachments` 가 하던 일이고, 수백 쪽을 한 번에 처리하는
 * 인프라를 놓고 세 쪽만 넣는 결과가 됐다. 총량은 예산이 자른다.
 */
async function choose(
  candidates: Link[],
  intent: string,
  what: string,
  ctx: Ctx,
): Promise<Link[]> {
  if (candidates.length === 0) return [];
  // 후보가 적으면 묻지 않는다. 왕복 하나가 후보 세 개를 거르는 값보다 비싸다.
  if (candidates.length <= 3) return candidates;

  const trimmed = candidates.slice(0, 60);
  try {
    const { value } = await runObject(
      { task: "intake", tier: "small", log: ctx.log, signal: ctx.signal },
      {
        role: "너는 공고 페이지의 링크 목록에서 이 신청과 관련된 것만 고르는 조사원이다.",
        schema: pickSchema,
        repair: 0,
        rules: [
          `- 고를 것: ${what}.`,
          "- **다른 공고는 고르지 않는다.** 제목의 사업명·기수·연도가 목표와 다르면 버린다.",
          "- 개인정보처리방침·이용약관·사이트맵·로그인·배너는 고르지 않는다.",
          "- 관련 있으면 **개수를 아끼지 말고 전부** 고른다. 총량은 호출부가 자른다.",
          "- 하나도 관련이 없으면 빈 배열.",
        ],
        prompt: [
          `목표: ${intent}`,
          "",
          "링크 목록:",
          ...trimmed.map(
            (link, i) => `${i + 1}. ${link.text || "(글자 없음)"} — ${link.url}`,
          ),
        ].join("\n"),
      },
    );
    const allowed = new Map(trimmed.map((link) => [link.url, link]));
    const picked = (value.urls ?? [])
      .map((url) => allowed.get(url))
      .filter((link): link is Link => Boolean(link));
    return picked;
  } catch (error) {
    if (isAbort(error)) throw error;
    // 모델이 실패해도 수집을 멈추지 않는다. 확장자가 확실한 것만 집는다.
    ctx.log(`관련성 판단 실패 — 확장자로만 고른다: ${message(error)}`);
    return trimmed.filter((link) =>
      /\.(pdf|hwpx?|docx?|xlsx?|pptx?)(\?|#|$)/i.test(link.url),
    );
  }
}

/**
 * 2홉째에 열어 볼 상세 페이지인가.
 *
 * 게이트가 셋이다 — 문서가 아니고, **같은 사이트**이고, 공고처럼 보이는 글자다.
 * 호스트를 안 걸면 배너 광고나 상위 기관 홈으로 넘어가고, 거기서 받은 것이
 * Studio 에 섞이면 분류가 두 공고 사이에서 흔들린다.
 */
export function isDetailCandidate(
  link: Link,
  opts: { hosts: Set<string>; seedUrls: Set<string> },
): boolean {
  return (
    !link.isDocument &&
    !opts.seedUrls.has(link.url) &&
    opts.hosts.has(host(link.url)) &&
    !NOISE.test(link.text) &&
    DETAIL_HINT.test(`${link.text} ${link.url}`)
  );
}

/** 등록 도메인 근사. `www.` 만 턴다 — PSL 을 들고 오지 않는다 */
export function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * 파일 내용의 지문.
 *
 * **크기 + 이름으로 근사하지 않는다.** 같은 문서가 다른 이름·다른 URL 로 오는
 * 것이 정확히 우리가 잡으려는 경우다. 한 번 읽은 Blob 은 캐시해 둔다 —
 * 이 파일은 곧 Studio 로 다시 올라가므로 두 번 읽을 이유가 없다.
 */
const digests = new WeakMap<Blob, string>();

async function digest(blob: Blob): Promise<string> {
  const cached = digests.get(blob);
  if (cached) return cached;
  const hash = createHash("sha256")
    .update(Buffer.from(await blob.arrayBuffer()))
    .digest("hex");
  digests.set(blob, hash);
  return hash;
}

/** Studio 에 무엇을 얼마나 넣는지 한 줄로. 증거는 숫자여야 한다 */
export function harvestSummary(files: IntakeFile[]): string {
  const bytes = files.reduce((sum, file) => sum + file.blob.size, 0);
  const byOrigin = files.reduce<Record<string, number>>((acc, file) => {
    acc[file.origin] = (acc[file.origin] ?? 0) + 1;
    return acc;
  }, {});
  const where = Object.entries(byOrigin)
    .map(([origin, count]) => `${ORIGIN_LABEL[origin] ?? origin} ${count}`)
    .join(" · ");
  return `${files.length}개 · ${kb(bytes)} · ${where || "없음"}`;
}

const ORIGIN_LABEL: Record<string, string> = {
  upload: "직접 올림",
  url: "링크에서",
  crawl: "찾아냄",
  synth: "만들어 냄",
};

function kb(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)}KB`
    : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
