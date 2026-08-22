import { existsSync } from "node:fs";
import { chromium } from "playwright";

import { demoSites, noticePath } from "@/app/demo/_lib/sites";

export const runtime = "nodejs";

const SYSTEM_CHROMIUM = "/usr/bin/chromium";

function origin(): string {
  return `http://localhost:${process.env.PORT ?? "3000"}`;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/demo/[slug]/notice.pdf">,
): Promise<Response> {
  const { slug } = await context.params;
  const site = demoSites.find((item) => item.slug === slug);
  if (!site) return new Response("Not found", { status: 404 });

  const fileName = `${site.slug}-notice.pdf`;
  const executablePath = existsSync(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : undefined;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath
      ? { executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
      : {}),
  });
  const page = await browser.newPage();
  let pdf: Uint8Array;
  try {
    // v4 는 루트가 공지 목록이라 공고 상세 경로를 레지스트리에서 받는다.
    await page.goto(`${origin()}${noticePath(site)}`, { waitUntil: "networkidle" });
    pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
  const body = new Uint8Array(pdf.length);
  body.set(pdf);
  return new Response(body, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}
