import { existsSync } from "node:fs";
import { chromium } from "playwright";

import { demoSites } from "@/app/demo/_lib/sites";

/**
 * 홍보 이미지 — 포스터 페이지를 그대로 찍는다.
 *
 * 데모의 첫 트리거가 공고문 PDF 아니면 **이 한 장**이다. 그래서 SVG 가 아니라
 * PNG 여야 한다 — 문서 파서가 읽는 것은 래스터 이미지다. 2배 스케일로 찍어
 * 작은 글씨(주최·문의처·URL)까지 OCR 에 남긴다.
 */
export const runtime = "nodejs";

const SYSTEM_CHROMIUM = "/usr/bin/chromium";
const WIDTH = 1080;
const HEIGHT = 1350;

export async function GET(
  _request: Request,
  context: RouteContext<"/demo/[slug]/poster.png">,
): Promise<Response> {
  const { slug } = await context.params;
  const site = demoSites.find((item) => item.slug === slug);
  if (!site?.poster) return new Response("Not found", { status: 404 });

  const executablePath = existsSync(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : undefined;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath
      ? { executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] }
      : {}),
  });
  let shot: Uint8Array;
  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 2,
    });
    await page.goto(
      `http://localhost:${process.env.PORT ?? "3000"}/demo/${site.slug}/poster`,
      { waitUntil: "networkidle" },
    );
    shot = await page.screenshot({ type: "png" });
  } finally {
    await browser.close();
  }

  const body = new Uint8Array(shot.length);
  body.set(shot);
  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${site.slug}-poster.png"`,
      "Cache-Control": "no-store",
    },
  });
}
