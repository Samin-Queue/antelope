import { existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { chromium, type Browser } from "playwright";
import { z } from "zod";

import { getDb, schema } from "@/lib/db";
import { required } from "@/lib/env";

type Opportunity = {
  readonly category: string;
  readonly source: string;
  readonly title: string;
  readonly url: string;
  readonly content: string;
};

const LINK_SOURCES = [
  {
    category: "학자금 지원 제도",
    source: "한국장학재단",
    url: "https://www.kosaf.go.kr/ko/main.do",
  },
  { category: "주택 청약", source: "LH 청약센터", url: "https://apply.lh.or.kr/" },
] as const;

const SYSTEM_CHROMIUM = "/usr/bin/chromium";

export function crawlerBrowserOptions() {
  const executablePath = existsSync(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : undefined;
  return {
    headless: true,
    ...(executablePath
      ? {
          executablePath,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        }
      : {}),
  };
}

const examItemSchema = z.object({
  implYy: z.string(),
  implSeq: z.union([z.string(), z.number()]),
  qualgbNm: z.string(),
  description: z.string(),
  docRegStartDt: z.string(),
  docRegEndDt: z.string(),
  docExamStartDt: z.string(),
  docExamEndDt: z.string(),
  docPassDt: z.string(),
  pracRegStartDt: z.string(),
  pracRegEndDt: z.string(),
  pracExamStartDt: z.string(),
  pracExamEndDt: z.string(),
  pracPassDt: z.string(),
});

const examResponseSchema = z.object({
  header: z.object({ resultCode: z.string(), resultMsg: z.string() }),
  body: z.object({ items: z.array(examItemSchema) }),
});

function textFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);
}

const screenshots = new Map<string, Promise<string>>();

function apiUrl(base: string, path: string, key: string, query: URLSearchParams): string {
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/$/, "")}${path}`;
  url.search = `serviceKey=${key}&${query.toString()}`;
  return url.toString();
}

function xmlValue(xml: string, tag: string): string {
  const value = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? "";
  return value.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1").trim();
}

function jobOpportunities(xml: string): readonly Opportunity[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items.flatMap((item) => {
    const title = xmlValue(item, "pblancNm");
    const url = xmlValue(item, "pblancUrl");
    if (title === "" || url === "") return [];

    return [
      {
        category: "정부지원사업",
        source: "기업마당",
        title,
        url,
        content: [
          xmlValue(item, "bsnsSumryCn"),
          `신청 기간: ${xmlValue(item, "reqstBeginEndDe")}`,
          `지원 대상: ${xmlValue(item, "trgetNm")}`,
          `신청 방법: ${xmlValue(item, "reqstMthPapersCn")}`,
          `문의: ${xmlValue(item, "inqireCo")}`,
        ]
          .filter((value) => value !== "")
          .map(textFromHtml)
          .join("\n"),
      },
    ];
  });
}

function date(value: string): string {
  return value.length === 8
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
    : "미정";
}

function dateRange(start: string, end: string): string {
  return start === "" && end === "" ? "미정" : `${date(start)} ~ ${date(end)}`;
}

function examOpportunities(data: unknown): readonly Opportunity[] {
  const response = examResponseSchema.parse(data);
  if (response.header.resultCode !== "00") {
    throw new Error(`Q-Net API 오류: ${response.header.resultMsg}`);
  }

  return response.body.items.map((item) => ({
    category: "자격증·시험",
    source: "Q-Net",
    title: item.description,
    url: "https://www.q-net.or.kr/crf005.do?id=crf00501&gSite=Q",
    content: [
      `${item.implYy}년 ${item.qualgbNm} 제${item.implSeq}회`,
      `필기 접수: ${dateRange(item.docRegStartDt, item.docRegEndDt)}`,
      `필기 시험: ${dateRange(item.docExamStartDt, item.docExamEndDt)}`,
      `필기 합격 발표: ${date(item.docPassDt)}`,
      `실기 접수: ${dateRange(item.pracRegStartDt, item.pracRegEndDt)}`,
      `실기 시험: ${dateRange(item.pracExamStartDt, item.pracExamEndDt)}`,
      `실기 합격 발표: ${date(item.pracPassDt)}`,
    ].join("\n"),
  }));
}

async function captureScreenshot(browser: Browser, url: string): Promise<string> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return (await page.screenshot({ type: "png" })).toString("base64");
  } finally {
    await page.close();
  }
}

function screenshot(browser: Browser, url: string): Promise<string> {
  const next = screenshots.get(url) ?? captureScreenshot(browser, url);
  screenshots.set(url, next);
  return next;
}

async function saveOpportunity(
  browser: Browser,
  crawlRunId: string,
  opportunity: Opportunity,
): Promise<void> {
  const image = await screenshot(browser, opportunity.url);
  await getDb()
    .insert(schema.opportunityCards)
    .values({
      crawlRunId,
      ...opportunity,
      screenshot: image,
    });
}

async function saveLinkSource(
  browser: Browser,
  crawlRunId: string,
  source: (typeof LINK_SOURCES)[number],
): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
    await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const [title, html, image] = await Promise.all([
      page.title(),
      page.content(),
      page.screenshot({ type: "png" }),
    ]);
    await getDb()
      .insert(schema.opportunityCards)
      .values({
        crawlRunId,
        ...source,
        title: title || "최신 공고",
        content: textFromHtml(html),
        screenshot: image.toString("base64"),
      });
  } finally {
    await page.close();
  }
}

async function fetchJobOpportunities(): Promise<readonly Opportunity[]> {
  const response = await fetch(
    apiUrl(
      required("JOB_CRAWLING_URL"),
      "/pblancBsnsService",
      required("JOB_CRAWLING_API_KEY"),
      new URLSearchParams({ pageNo: "1", numOfRows: "5" }),
    ),
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!response.ok) throw new Error(`기업마당 API ${response.status}`);
  return jobOpportunities(await response.text());
}

async function fetchExamOpportunities(): Promise<readonly Opportunity[]> {
  const response = await fetch(
    apiUrl(
      required("EXAM_CRAWLING_URL"),
      "/getQualExamSchdList",
      required("EXAM_CRAWLING_API_KEY"),
      new URLSearchParams({
        pageNo: "1",
        numOfRows: "5",
        dataFormat: "json",
        implYy: String(new Date().getFullYear()),
      }),
    ),
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!response.ok) throw new Error(`Q-Net API ${response.status}`);
  return examOpportunities(await response.json());
}

export async function crawlOpportunities(closeDb = false): Promise<void> {
  const db = getDb();
  const [run] = await db
    .insert(schema.crawlRuns)
    .values({})
    .returning({ id: schema.crawlRuns.id });
  if (!run) throw new Error("크롤 실행을 만들지 못했습니다.");
  console.info("[crawler] 수집 시작", { runId: run.id });

  const browser = await chromium.launch(crawlerBrowserOptions());
  try {
    const sources = await Promise.all([
      fetchJobOpportunities(),
      fetchExamOpportunities(),
    ]);
    console.info("[crawler] API 응답", {
      job: sources[0].length,
      exam: sources[1].length,
    });

    for (const opportunity of sources.flat()) {
      try {
        await saveOpportunity(browser, run.id, opportunity);
      } catch (error: unknown) {
        console.error(error);
      }
    }

    for (const source of LINK_SOURCES) {
      try {
        await saveLinkSource(browser, run.id, source);
      } catch (error: unknown) {
        console.error(error);
      }
    }

    await db
      .update(schema.crawlRuns)
      .set({ completedAt: new Date() })
      .where(eq(schema.crawlRuns.id, run.id));
    console.info("[crawler] 수집 완료", { runId: run.id });
  } finally {
    await (closeDb
      ? Promise.all([browser.close(), db.$client.end({ timeout: 5 })])
      : browser.close());
  }
}

if (process.argv[1]?.endsWith("crawl-opportunities.ts")) {
  void crawlOpportunities(true).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
