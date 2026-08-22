import { chromium } from "playwright";

import { demoSites } from "@/app/demo/_lib/sites";

export const runtime = "nodejs";

function noticeHtml(site: (typeof demoSites)[number]): string {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  body { color: #171717; font-family: "Noto Sans CJK KR", "Nanum Gothic", sans-serif; line-height: 1.7; }
  h1 { font-size: 23px; line-height: 1.45; margin: 8px 0 24px; }
  .kind { color: #555; font-size: 12px; font-weight: 700; }
  dl { border-top: 1px solid #d4d4d4; margin: 0; }
  div { border-bottom: 1px solid #e5e5e5; display: flex; gap: 24px; padding: 10px 0; }
  dt { color: #737373; min-width: 76px; } dd { margin: 0; }
  h2 { font-size: 15px; margin: 32px 0 8px; } p { font-size: 13px; margin: 0; }
  .apply { background: #f5f5f5; margin-top: 28px; padding: 16px; }
</style></head><body>
  <p class="kind">${site.klass}</p><h1>${site.title}</h1>
  <dl><div><dt>주관 기관</dt><dd>${site.org}</dd></div><div><dt>접수 마감</dt><dd>${site.deadline}</dd></div></dl>
  <h2>공고 안내</h2><p>${site.mechanism}</p>
  <section class="apply"><strong>온라인 신청</strong><p>https://antelope.up.railway.app/demo/${site.slug}/apply</p></section>
</body></html>`;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/demo/[slug]/notice.pdf">,
): Promise<Response> {
  const { slug } = await context.params;
  const site = demoSites.find((item) => item.slug === slug);
  if (!site) return new Response("Not found", { status: 404 });

  const fileName = `${site.slug}-notice.pdf`;
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  let pdf: Uint8Array;
  try {
    await page.setContent(noticeHtml(site), { waitUntil: "load" });
    pdf = await page.pdf({ format: "A4", printBackground: true });
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
