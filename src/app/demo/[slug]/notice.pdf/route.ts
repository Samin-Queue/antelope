import { demoSites } from "@/app/demo/_lib/sites";

export const runtime = "nodejs";

function pdfEscape(value: string): string {
  return value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "?");
}

function createPdf(lines: readonly string[]): Uint8Array {
  const stream = [
    "BT",
    "/F1 16 Tf",
    "72 760 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? `(${pdfEscape(line)}) Tj` : `0 -24 Td (${pdfEscape(line)}) Tj`,
    ]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const start = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new TextEncoder().encode(output);
}

export async function GET(
  _request: Request,
  context: RouteContext<"/demo/[slug]/notice.pdf">,
): Promise<Response> {
  const { slug } = await context.params;
  const site = demoSites.find((item) => item.slug === slug);
  if (!site) return new Response("Not found", { status: 404 });

  const fileName = `${site.slug}-notice.pdf`;
  return new Response(createPdf([site.org, site.title, `Deadline: ${site.deadline}`]), {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}
