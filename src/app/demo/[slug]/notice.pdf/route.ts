import { existsSync } from "node:fs";
import { chromium } from "playwright";

import { demoSites } from "@/app/demo/_lib/sites";

export const runtime = "nodejs";

const SYSTEM_CHROMIUM = "/usr/bin/chromium";

function detailUrl(slug: string): string {
  return `http://localhost:${process.env.PORT ?? "3000"}/demo/${slug}`;
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
    await page.goto(detailUrl(site.slug), { waitUntil: "networkidle" });
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
