import { eq } from "drizzle-orm";
import { chromium } from "playwright";

import { getDb, schema } from "@/lib/db";

const SOURCES = [
  {
    category: "정부지원사업",
    source: "K-Startup",
    url: "https://www.k-startup.go.kr/web/main/mainSection0.do",
  },
  {
    category: "학자금 지원 제도",
    source: "한국장학재단",
    url: "https://www.kosaf.go.kr/ko/main.do",
  },
  { category: "주택 청약", source: "LH 청약센터", url: "https://apply.lh.or.kr/" },
] as const;

function titleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() || "최신 공고";
}

function textFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);
}

async function main(): Promise<void> {
  const db = getDb();
  const [run] = await db
    .insert(schema.crawlRuns)
    .values({})
    .returning({ id: schema.crawlRuns.id });
  if (!run) throw new Error("크롤 실행을 만들지 못했습니다.");
  const browser = await chromium.launch({ headless: true });
  try {
    for (const source of SOURCES) {
      const response = await fetch(source.url, {
        headers: { "User-Agent": "AntelopeCrawler/1.0" },
      });
      if (!response.ok) throw new Error(`${source.source} ${response.status}`);
      const html = await response.text();
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      const screenshot = await page.screenshot({ type: "png" });
      await page.close();
      await db.insert(schema.opportunityCards).values({
        crawlRunId: run.id,
        category: source.category,
        source: source.source,
        title: titleFromHtml(html),
        url: source.url,
        content: textFromHtml(html),
        screenshot: screenshot.toString("base64"),
      });
    }
    await db
      .update(schema.crawlRuns)
      .set({ completedAt: new Date() })
      .where(eq(schema.crawlRuns.id, run.id));
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
