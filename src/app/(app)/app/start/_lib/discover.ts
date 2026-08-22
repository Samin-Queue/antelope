import { tool } from "ai";
import { z } from "zod";

import { isAbort, runObject, runTools } from "@/lib/ai/gateway";
import { webSearch, type SearchHit } from "@/lib/search";

import { drill } from "./fetch";
import type { Ctx } from "./intake";
import { clip } from "./llm";

/**
 * 공고 찾기 — 링크도 파일도 없는 입력에 **시드를 만들어 준다.**
 *
 * 청사진의 계약(`BLUEPRINT.md` [3])은 착수 판정이 `{status:"proceed", seeds}` 를
 * 내게 돼 있었는데, 자연어 입력에서 `seeds` 를 만드는 수단이 코드에 없었다.
 * 그래서 「공고 제목만 붙여넣기」가 원문 0바이트로 끝났다 — 그러고도 멈추지
 * 않고, Solar 가 「정보 없음」으로 채운 요약 923자를 만들어 Studio 까지 태웠다.
 *
 * ## Solar 에는 내장 검색이 없다
 *
 * API 가 직접 그렇게 답한다 — `tools:[{type:"web_search"}]` 는
 * `400 Currently, only 'function' is supported`. 그러니 검색은 **우리가 도구로
 * 쥐여 줘야** 한다. 여기가 그 자리다.
 *
 * ## 싼 길을 먼저, 어려울 때만 루프
 *
 * ```
 * 1  검색어 만들기      solar-mini 1회      요청부를 뗀다
 * 2  검색               병렬 · 캐시 warm 시 530ms/건
 * 3  도구 루프          search · open · submit   (여기서 대개 1스텝에 끝난다)
 * 4  루프가 submit 없이 끝나면 → 기존 1회성 선별로 폴백
 * ```
 *
 * 2번까지는 결정론이고 빠르다. 루프가 버는 것은 **첫 검색이 빗나갔을 때**다 —
 * 검색어를 바꿔 다시 찾고, 애매하면 페이지를 열어 확인하고, 목록 페이지면 그
 * 안의 상세 링크를 따라간다. 고정 2단계는 그 자리에서 포기했다.
 *
 * ## 두 가지를 나눠 묻는 이유
 *
 * 검색어는 **원문 글자를 남기는** 문제다. 실측: 사용자 문장을 그대로 넣으면
 * (「우리가 자격 되는지 보고 신청까지 준비해줘」 포함) 6.6초에 12건이 오는데
 * 정답이 없고, 요청부를 뗀 질의는 537ms 에 정답을 낸다.
 * 고르는 일은 **버리는** 문제다 — 재게시 블로그·요약 사이트가 원문보다 위에 온다.
 *
 * ## 못 찾으면 못 찾았다고 한다
 *
 * 비슷한 다른 공고를 고르는 것이 아무것도 안 고르는 것보다 나쁘다. 잘못 고른
 * 시드는 요약·분석·입력 항목까지 전부 다른 공고로 채우고, 화면에는 그 사실이
 * 어디에도 안 나온다. 빈 배열이면 착수 판정이 사람에게 무엇이 없는지 묻는다.
 */
export type Discovery = {
  /** 실제로 열어 볼 주소. 최대 `MAX_PICK` 개 */
  urls: string[];
  queries: string[];
  hits: SearchHit[];
};

const MAX_QUERIES = 3;
const MAX_PICK = 3;
/** 루프 안에서 추가로 부를 수 있는 검색·열기 횟수 */
const MAX_SEARCH = 4;
const MAX_OPEN = 4;
const MAX_STEPS = 6;
/**
 * 루프의 **벽시계 예산.**
 *
 * 횟수만 막으면 안 된다. 실측: 모델이 첨부 파일의 다운로드 주소를 찾겠다고
 * 검색 5회 · 열기 5회를 다 쓰면서 `intake` 전체가 **139초**가 됐다 — 정작 그
 * 첨부는 바로 다음 `harvest` 가 페이지에서 받아 왔다. 예산이 끝나면 도구가
 * 「시간을 다 썼다」를 돌려주고, 모델은 지금까지 본 것에서 확정한다.
 */
const EXPLORE_BUDGET_MS = 45_000;
/** 폴백 선별 프롬프트에 실을 후보 수 */
const MAX_CANDIDATES = 40;

/** 확인된 것일수록 앞에. `link` 는 열어 본 페이지 안에서 이름만 본 것이다 */
function rank(hit: SearchHit): number {
  return hit.via === "open" ? 2 : hit.via === "link" ? 0 : 1;
}

export async function discover(text: string, ctx: Ctx): Promise<Discovery> {
  const queries = await searchQueries(text, ctx);
  if (queries.length === 0) return { urls: [], queries: [], hits: [] };
  ctx.log(`공고 검색어: ${queries.map((query) => `「${query}」`).join(" ")}`);

  const rounds = await Promise.all(queries.map((query) => search(query, ctx)));
  const hits = dedupe(rounds.flat());
  if (hits.length === 0) {
    ctx.log("검색 결과가 없다 — 사람에게 링크를 묻는다");
    return { urls: [], queries, hits };
  }

  /**
   * 루프가 본 것은 **폴백에도 넘긴다.**
   *
   * 루프가 확정을 못 해도 그동안 검색을 더 돌리고 페이지를 열어 봤다. 그걸
   * 버리고 처음 검색 결과로만 고르면, 루프가 정답 페이지를 열어 놓고도 폴백이
   * 재게시 사이트를 고르는 일이 실제로 난다(실측).
   */
  const explored = await explore(text, queries, hits, ctx);
  const seen = explored.seen.length > hits.length ? explored.seen : hits;
  const urls = explored.urls ?? (await pickPages(text, seen, ctx));
  ctx.log(
    urls.length
      ? `후보 ${seen.length}건에서 ${urls.length}개를 연다: ${urls.join(" ")}`
      : `후보 ${seen.length}건 중 이 공고로 확신할 수 있는 것이 없다`,
  );
  return { urls, queries, hits: seen };
}

function dedupe(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.url)) continue;
    seen.add(hit.url);
    out.push(hit);
  }
  return out;
}

async function search(query: string, ctx: Ctx): Promise<SearchHit[]> {
  try {
    return await webSearch(query, { signal: ctx.signal, log: ctx.log });
  } catch (error) {
    if (isAbort(error)) throw error;
    ctx.log(`검색 실패: ${message(error)}`);
    return [];
  }
}

/**
 * 도구 루프 — 모델이 스스로 다시 찾고 열어 본다.
 *
 * 반환이 `null` 이면 「루프가 결론을 못 냈다」이고, `[]` 는 「살펴봤지만 이 공고로
 * 확신할 수 있는 것이 없다」다. 둘을 구분해야 폴백을 걸지 말지 정할 수 있다.
 *
 * ⚠ 도구를 **직렬화하지 않는다.** 브라우저 조작은 병렬 호출이 서로를 덮어써서
 * 직렬로 묶었지만(`AGENTS.md`), 검색과 페이지 열기는 읽기 전용이고 서로 독립이다.
 * 대신 횟수로 막는다 — 상한이 없으면 죽은 링크만으로 스텝을 다 쓴다.
 */
async function explore(
  text: string,
  queries: string[],
  seeded: SearchHit[],
  ctx: Ctx,
): Promise<{ urls: string[] | null; seen: SearchHit[] }> {
  /** 모델이 본 적 있는 주소. `submit` 이 지어낸 URL 을 거를 기준이다 */
  const known = new Map(seeded.map((hit) => [hit.url, hit] as const));
  const deadline = Date.now() + EXPLORE_BUDGET_MS;
  let searched = 0;
  let opened = 0;
  let picked: string[] | null = null;

  /** 예산이 끝났으면 도구가 일하지 않고 그 사실만 돌려준다 */
  const spent = () =>
    Date.now() > deadline
      ? "시간 예산을 다 썼다. 더 찾지 말고 지금까지 본 것에서 submit 한다."
      : null;

  const tools = {
    search: tool({
      description:
        "웹을 검색한다. 첫 결과가 빗나갔으면 검색어를 바꿔 다시 부른다 — 지역·연도·주관 기관을 넣거나 빼 본다.",
      inputSchema: z.object({
        query: z.string().describe("검색어. 공고를 특정하는 사업명·연도·지역"),
      }),
      execute: async ({ query }) => {
        const over = spent();
        if (over) return over;
        if (searched >= MAX_SEARCH)
          return `검색 횟수를 다 썼다(${MAX_SEARCH}회). 지금까지 본 것에서 고르거나 submit 에 빈 배열을 낸다.`;
        searched += 1;
        const hits = await search(query, ctx);
        for (const hit of hits) if (!known.has(hit.url)) known.set(hit.url, hit);
        return hits.length ? list(hits) : "결과 없음.";
      },
    }),
    open: tool({
      description:
        "주소를 열어 제목·본문 앞부분·그 안의 링크를 본다. 그 공고가 맞는지 확인하거나, 목록 페이지에서 상세 링크를 찾을 때 쓴다.",
      inputSchema: z.object({ url: z.string().describe("열어 볼 주소") }),
      execute: async ({ url }) => {
        const over = spent();
        if (over) return over;
        if (opened >= MAX_OPEN)
          return `열어 본 횟수를 다 썼다(${MAX_OPEN}회). 지금까지 본 것에서 고른다.`;
        opened += 1;
        try {
          const result = await drill(url, "crawl");
          if (result.kind === "file") {
            // 파일도 시드로 유효하다. 공고문 원본이면 오히려 이쪽이 낫다.
            known.set(url, { url, title: result.file.name, snippet: "", via: "open" });
            ctx.log(`열어 봄(파일): ${result.file.name}`);
            return `이 주소는 파일이다 — ${result.file.name} (${Math.round(result.file.blob.size / 1024)}KB). 공고문 원본이면 그대로 submit 해도 된다.`;
          }
          const page = result.page;
          known.set(page.url, {
            url: page.url,
            title: page.title,
            snippet: clip(page.text, 200),
            via: "open",
          });
          for (const link of page.links) {
            if (!known.has(link.url)) {
              known.set(link.url, {
                url: link.url,
                title: link.text,
                snippet: "",
                via: "link",
              });
            }
          }
          ctx.log(`열어 봄: ${page.title || page.url} · 본문 ${page.text.length}자`);
          return [
            `제목: ${page.title || "(없음)"}`,
            `주소: ${page.url}`,
            "본문:",
            clip(page.text, 1_500),
            "",
            "이 페이지의 링크(공고·첨부처럼 보이는 것 위주):",
            ...page.links
              .filter((link) =>
                /공고|모집|신청|접수|지원|붙임|첨부|상세|view|detail/i.test(
                  `${link.text} ${link.url}`,
                ),
              )
              .slice(0, 20)
              .map((link) => `- ${link.text || "(글자 없음)"} — ${link.url}`),
          ].join("\n");
        } catch (error) {
          if (isAbort(error)) throw error;
          ctx.log(`열기 실패: ${url} — ${message(error)}`);
          return `열지 못했다: ${message(error)}`;
        }
      },
    }),
    submit: tool({
      description:
        "공고 원문 페이지를 확정하고 끝낸다. 반드시 마지막에 한 번 부른다. 확신이 없으면 urls 를 빈 배열로 낸다.",
      inputSchema: z.object({
        urls: z
          .array(z.string())
          .describe(`고른 주소. 최대 ${MAX_PICK}개, 확신 없으면 빈 배열`),
        reason: z.string().describe("왜 그것인지 한 문장"),
      }),
      execute: ({ urls, reason }) => {
        const out: string[] = [];
        for (const url of urls) {
          const trimmed = url.trim();
          // 본 적 없는 주소는 모델이 지어낸 것이다. 열지 않는다.
          if (known.has(trimmed) && !out.includes(trimmed)) out.push(trimmed);
        }
        picked = out.slice(0, MAX_PICK);
        ctx.log(`확정: ${picked.length}개 — ${reason}`);
        return "확정했다.";
      },
    }),
  };

  try {
    const { steps } = await runTools(
      { task: "discover.explore", log: ctx.log, signal: ctx.signal },
      {
        system: [
          "너는 사용자가 말한 공고의 **원문 페이지**를 찾아 확정하는 조사원이다.",
          "- 이미 돌린 검색 결과가 아래에 있다. 충분하면 곧장 submit 한다.",
          "- 빗나갔으면 search 로 검색어를 바꿔 다시 찾는다.",
          "- 그 공고가 맞는지 애매하면 open 으로 열어 확인한다. 목록 페이지면 그 안의 상세 링크를 open 한다.",
          "- 주관 기관·공고 포털을 재게시 블로그·요약 사이트보다 앞에 둔다.",
          "- 공고문·신청서가 첨부로 달린 페이지가 가장 좋다.",
          "- **첨부 파일의 다운로드 주소는 찾지 않는다.** 원문 페이지만 고르면 다음 단계가 그 페이지의 첨부를 알아서 받는다.",
          "- 후보가 이미 충분하면 더 찾지 말고 곧장 submit 한다. 검색·열기는 빗나갔을 때만 쓴다.",
          "- 같은 공고가 여러 사이트에 있으면 하나만 고른다.",
          "- 연도·지역·사업명이 사용자 문장과 어긋나면 고르지 않는다.",
          "- **확신이 없으면 submit 에 빈 배열을 낸다.** 비슷한 다른 공고를 고르는 것이 아무것도 안 고르는 것보다 나쁘다.",
          "- 마지막에 반드시 submit 을 부른다.",
        ].join("\n"),
        prompt: [
          `사용자가 말한 것: ${clip(text, 1_000)}`,
          "",
          `이미 돌린 검색어: ${queries.map((query) => `「${query}」`).join(" ")}`,
          "",
          "그 결과:",
          list(seeded),
        ].join("\n"),
        tools,
        maxSteps: MAX_STEPS,
        stopOnToolCall: "submit",
      },
    );
    ctx.log(`도구 루프 ${steps}스텝 · 검색 ${searched}회 · 열기 ${opened}회`);
    return { urls: picked, seen: [...known.values()] };
  } catch (error) {
    if (isAbort(error)) throw error;
    ctx.log(`도구 루프 실패: ${message(error)}`);
    return { urls: null, seen: [...known.values()] };
  }
}

function list(hits: SearchHit[]): string {
  return hits
    .map(
      (hit, index) =>
        `${index + 1}. [${hit.via}] ${hit.title}\n   ${hit.url}` +
        (hit.snippet ? `\n   ${clip(hit.snippet, 300)}` : ""),
    )
    .join("\n");
}

const querySchema = z.object({ queries: z.array(z.string()).nullish() });

async function searchQueries(text: string, ctx: Ctx): Promise<string[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const { value } = await runObject(
      { task: "discover.queries", tier: "small", log: ctx.log, signal: ctx.signal },
      {
        role: "너는 사용자 문장에서 공고를 찾아낼 검색어를 만드는 보조자다.",
        schema: querySchema,
        repair: 0,
        rules: [
          `- queries: 이 공고 하나를 특정할 검색어. **최대 ${MAX_QUERIES}개**, 짧은 순으로.`,
          "- 사용자의 **요청부를 뗀다** — 「자격 되는지 봐줘」·「신청까지 준비해줘」는 검색어가 아니다.",
          "- 지역·연도·주관 기관·사업명은 **남긴다**. 같은 이름의 공고가 해마다 있다.",
          "- 원문에 있는 글자만 쓴다. **없는 낱말을 지어내지 않는다.**",
          "- 공고를 가리키는 이름이 문장에 없으면 빈 배열.",
        ],
        prompt: clip(trimmed, 4_000),
        normalize: (raw) =>
          (raw.queries ?? [])
            .map((query) => query.trim())
            .filter(Boolean)
            .slice(0, MAX_QUERIES),
      },
    );
    // 모델이 다 떨어뜨려도 사용자가 준 문장 자체는 유효한 검색어다.
    return value.length > 0 ? value : [clip(trimmed, 120)];
  } catch (error) {
    if (isAbort(error)) throw error;
    ctx.log(`검색어 생성 실패 — 입력 문장을 그대로 쓴다: ${message(error)}`);
    return [clip(trimmed, 120)];
  }
}

const pickSchema = z.object({ urls: z.array(z.string()).nullish() });

/**
 * 폴백 — 도구 루프가 결론을 못 냈을 때 한 번에 고른다.
 *
 * 루프가 실패하는 경우가 실제로 있다(도구 호출 형식이 깨지거나, 스텝 상한에서
 * submit 을 못 부르거나). 그때 아무것도 안 고르면 검색까지 해 놓고 사람에게
 * 되묻게 되는데, 결과 목록은 이미 손에 있다.
 */
async function pickPages(text: string, seen: SearchHit[], ctx: Ctx): Promise<string[]> {
  /**
   * 프롬프트에 다 싣지 않는다. 루프가 페이지를 열면 그 안의 링크까지 후보로
   * 쌓여 100건을 넘는데(실측 132건), 그 대부분은 열어 본 적 없는 링크다.
   * 실제로 검색·열기로 확인된 것을 앞에 둔다.
   */
  const hits = [...seen].sort((a, b) => rank(b) - rank(a)).slice(0, MAX_CANDIDATES);
  const allowed = new Set(hits.map((hit) => hit.url));
  try {
    const { value } = await runObject(
      { task: "discover.pick", log: ctx.log, signal: ctx.signal },
      {
        role: "너는 검색 결과에서 공고 원문 페이지를 고르는 조사원이다.",
        schema: pickSchema,
        rules: [
          `- urls: 사용자가 말한 **바로 그 공고**의 원문 페이지. 목록에 있는 URL 만, 최대 ${MAX_PICK}개.`,
          "- 주관 기관·공고 포털을 재게시 블로그·요약 사이트보다 앞에 둔다.",
          "- 같은 공고가 여러 사이트에 있으면 하나만 고른다.",
          "- **확신이 없으면 빈 배열.** 비슷한 다른 공고를 고르는 것이 아무것도 안 고르는 것보다 나쁘다.",
          "- 연도·지역·사업명이 사용자 문장과 어긋나면 고르지 않는다.",
        ],
        prompt: [
          `사용자가 말한 것: ${clip(text, 1_000)}`,
          "",
          "검색 결과:",
          list(hits),
        ].join("\n"),
        normalize: (raw) => {
          const out: string[] = [];
          for (const url of raw.urls ?? []) {
            const trimmed = url.trim();
            // 목록 밖의 URL 은 모델이 지어낸 것이다. 열지 않는다.
            if (allowed.has(trimmed) && !out.includes(trimmed)) out.push(trimmed);
          }
          return out.slice(0, MAX_PICK);
        },
      },
    );
    return value;
  } catch (error) {
    if (isAbort(error)) throw error;
    ctx.log(`공고 선별 실패: ${message(error)}`);
    return [];
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
