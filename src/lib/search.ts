import { env } from "./env";

/**
 * 웹 검색 — 청사진 [4] 자료 수집의 첫 항목.
 *
 * `BLUEPRINT.md` 는 자료 수집을 「**웹 검색** · 웹 탐색 · 첨부 파일 · 페이지
 * 자체를 파일로」 넷으로 적어 두었는데, 구현된 것은 뒤의 셋뿐이었다
 * (`start/_lib/harvest.ts`). 그래서 사용자가 **공고 제목만** 던지면 파이프라인이
 * 읽을 원문이 0바이트였고, 그 위에서 Solar 가 「정보 없음」으로 채운 요약
 * 923자를 만들어 그대로 Studio 까지 흘러갔다 — 실측이다.
 *
 * ## 레인을 여럿 두는 이유
 *
 * 하나로는 못 덮는다. 실측(2026-08-23, 「포항시 2026년 AI라이브커머스 지원기업
 * 추가 모집 공고」):
 *
 * | 레인      | 결과                                                        |
 * | --------- | ----------------------------------------------------------- |
 * | `naver`   | `pohang.go.kr/economy/anm/master/view.do?...idx=156` — 정답 |
 * | `bizinfo` | 전체 1,510건에 없음 — 지자체 자체 공고는 안 올라온다        |
 *
 * 반대로 중앙부처 지원사업은 `bizinfo` 가 제목·소관·요약을 구조화해서 주므로
 * HTML 을 긁는 것보다 정확하다. 둘을 **병렬로** 돌리고 합친다.
 *
 * ⚠ `naver` 레인은 HTML 을 긁는다. 마크업이 바뀌면 조용히 0건이 되므로
 * `webSearch` 는 레인별 건수를 로그로 남기고, 0건을 예외로 만들지 않는다 —
 * 검색이 실패해도 파이프라인은 「무엇이 없어서 못 하는지」를 사람에게 물어야지
 * 통째로 죽으면 안 된다. 네이버 클래스명은 난독화되어 있어 선택자를 못 믿는다.
 * 그래서 **앵커 태그만** 본다 — 링크와 그 안의 글자는 마크업이 바뀌어도 남는다.
 */
export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  /** 어느 레인이 찾았는가. 화면 로그와 근거 표시에 그대로 나간다 */
  via: string;
};

const TIMEOUT_MS = 12_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** 검색 결과가 아니라 네이버 자기 화면인 링크 */
const NAVER_HOSTS = /(^|\.)(naver\.(com|net)|navercorp\.com|pstatic\.net)$/i;

/** 어느 검색에도 답이 아닌 것들 */
const JUNK =
  /\.(css|js|png|jpe?g|gif|svg|ico|woff2?)($|\?)|^https?:\/\/(www\.)?(facebook|twitter|x|instagram|youtube|tiktok)\.com/i;

/** 지금 쓸 수 있는 레인. `/api/health` 가 그대로 낸다 */
export function searchProviders(): string[] {
  const out = ["naver"];
  if (env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET) out.push("naver-api");
  if (env.JOB_CRAWLING_URL && env.JOB_CRAWLING_API_KEY) out.push("bizinfo");
  return out;
}

export async function webSearch(
  query: string,
  opts: { limit?: number; signal?: AbortSignal; log?: (text: string) => void } = {},
): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const limit = opts.limit ?? 12;
  const log = opts.log ?? (() => {});

  const lanes: Array<Promise<SearchHit[]>> = [
    naverHtml(trimmed, opts.signal),
    naverApi(trimmed, opts.signal),
    bizinfo(trimmed, opts.signal),
  ];
  const settled = await Promise.allSettled(lanes);

  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const result of settled) {
    if (result.status === "rejected") {
      log(`검색 레인 실패: ${message(result.reason)}`);
      continue;
    }
    for (const hit of result.value) {
      const key = canonical(hit.url);
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(hit);
    }
  }
  const counts = settled
    .map((result, index) =>
      result.status === "fulfilled"
        ? `${["naver", "naver-api", "bizinfo"][index]} ${result.value.length}`
        : null,
    )
    .filter(Boolean)
    .join(" · ");
  log(`검색 「${trimmed}」 → ${hits.length}건 (${counts || "없음"})`);
  return hits.slice(0, limit);
}

/**
 * 키 없이 도는 레인.
 *
 * 검색 API 키를 팀 전원이 발급받아야 데모가 도는 상태를 만들지 않는다 —
 * OCR 이 `UPSTAGE_API_KEY` 없으면 tesseract 로 떨어지는 것과 같은 이유다.
 * DuckDuckGo(html·lite)·Startpage·searx 공개 인스턴스는 전부 봇 차단으로
 * 202/캡챠를 돌려준다(실측). 네이버 웹검색만 200 에 결과를 실어 준다.
 */
async function naverHtml(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const url = `https://search.naver.com/search.naver?where=web&query=${encodeURIComponent(query)}`;
  const html = await text(url, {}, signal);

  /** url → 가장 긴 앵커 글자. 같은 링크가 아이콘·썸네일로도 걸려 있다 */
  const labels = new Map<string, string>();
  const anchor = /<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchor)) {
    const href = decode(match[1]!);
    if (JUNK.test(href)) continue;
    let host: string;
    try {
      host = new URL(href).hostname;
    } catch {
      continue;
    }
    if (NAVER_HOSTS.test(host)) continue;
    const label = strip(match[2] ?? "");
    const known = labels.get(href) ?? "";
    if (label.length > known.length) labels.set(href, label);
    else if (!labels.has(href)) labels.set(href, label);
  }
  return [...labels].slice(0, 20).map(([url, label]) => ({
    url,
    title: label.slice(0, 200) || url,
    snippet: "",
    via: "naver",
  }));
}

/** 키가 있으면 같은 네이버를 규격대로 부른다. 마크업 변화에 안 흔들린다 */
async function naverApi(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const id = env.NAVER_CLIENT_ID;
  const secret = env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return [];
  const url = `https://openapi.naver.com/v1/search/webkr.json?display=15&query=${encodeURIComponent(query)}`;
  const body = await text(
    url,
    { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
    signal,
  );
  const parsed: unknown = JSON.parse(body);
  const items =
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { items?: unknown }).items)
      ? ((parsed as { items: Array<Record<string, unknown>> }).items ?? [])
      : [];
  return items
    .map((item) => ({
      url: String(item.link ?? ""),
      title: strip(String(item.title ?? "")),
      snippet: strip(String(item.description ?? "")),
      via: "naver-api",
    }))
    .filter((hit) => /^https?:\/\//.test(hit.url));
}

/**
 * 기업마당(공공데이터포털) — 중앙부처·지자체 지원사업 공고 목록.
 *
 * 검색 파라미터가 없어서 **전체를 받아 제목으로 고른다.** 실측 1,510건 /
 * 3.6MB × 2페이지라 매 실행마다 받을 수는 없으므로 10분 캐시한다.
 *
 * ⚠ 발급 키는 이미 URL 인코딩돼 있다. `URLSearchParams` 에 넣으면 `%2F` 가
 * 다시 인코딩돼 인증이 깨진다 — 쿼리 문자열에 그대로 붙인다.
 */
type BizRow = { title: string; url: string; org: string; summary: string };

let bizCache: { at: number; rows: BizRow[] } | null = null;
const BIZ_TTL_MS = 10 * 60 * 1000;

async function bizinfo(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const base = env.JOB_CRAWLING_URL;
  const key = env.JOB_CRAWLING_API_KEY;
  if (!base || !key) return [];
  const rows = await bizRows(base, key, signal);
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];

  return rows
    .map((row) => ({ row, score: overlap(tokens, row.title) }))
    .filter((scored) => scored.score >= 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ row }) => ({
      url: row.url,
      title: row.title,
      snippet: [row.org, strip(row.summary).slice(0, 300)].filter(Boolean).join(" · "),
      via: "bizinfo",
    }));
}

async function bizRows(
  base: string,
  key: string,
  signal?: AbortSignal,
): Promise<BizRow[]> {
  const now = Date.now();
  if (bizCache && now - bizCache.at < BIZ_TTL_MS) return bizCache.rows;

  const rows: BizRow[] = [];
  for (const page of [1, 2]) {
    const url = `${base.replace(/\/$/, "")}/pblancBsnsService?serviceKey=${key}&pageNo=${page}&numOfRows=1000`;
    const xml = await text(url, {}, signal, 30_000);
    for (const item of xml.split("<item>").slice(1)) {
      const title = tag(item, "pblancNm");
      const link = tag(item, "pblancUrl");
      if (!title || !link) continue;
      rows.push({
        title,
        url: link,
        org: tag(item, "jrsdInsttNm"),
        summary: tag(item, "bsnsSumryCn"),
      });
    }
    // 마지막 페이지면 더 안 부른다. 1,000개 미만이 곧 끝이다.
    if (rows.length % 1000 !== 0) break;
  }
  bizCache = { at: now, rows };
  return rows;
}

function tag(xml: string, name: string): string {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  if (!match) return "";
  return decode(match[1]!.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")).trim();
}

/**
 * 질의를 2글자 이상 토큰으로 자른다.
 *
 * 한국어 공고 제목은 조사·괄호·중점(ㆍ)이 섞여 형태소 분석 없이는 못 쪼갠다.
 * 대신 **공백·기호로 자르고 2글자 미만을 버리는** 것으로 충분하다 — 이 매칭이
 * 하는 일은 순위가 아니라 1,510건에서 후보를 남기는 것이고, 최종 선별은
 * 모델이 원문을 보고 한다.
 */
export function queryTokens(query: string): string[] {
  return [
    ...new Set(
      query
        .replace(/[[\]()（）「」【】·ㆍ,~—–-]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  ];
}

export function overlap(tokens: string[], target: string): number {
  const hit = tokens.filter((token) => target.includes(token)).length;
  return hit / tokens.length;
}

/** 같은 문서를 두 번 열지 않는다. 프로토콜·`www`·해시·추적 쿼리는 무시 */
export function canonical(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.protocol = "https:";
    parsed.hostname = parsed.hostname.replace(/^www\./, "");
    for (const param of [...parsed.searchParams.keys()]) {
      if (/^utm_|^fbclid$|^gclid$/i.test(param)) parsed.searchParams.delete(param);
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

async function text(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
  timeoutMs = TIMEOUT_MS,
): Promise<string> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9", ...headers },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} → HTTP ${response.status}`);
  return response.text();
}

function strip(html: string): string {
  return decode(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decode(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
