import { parseBlocks } from "@/app/(app)/app/start/_lib/render/blocks";
import { renderDocx } from "@/app/(app)/app/start/_lib/render/docx";
import { renderHwp } from "@/app/(app)/app/start/_lib/render/hwp";
import { renderPdf } from "@/app/(app)/app/start/_lib/render/pdf";
import { renderXlsx } from "@/app/(app)/app/start/_lib/render/xlsx";
import { findFile } from "@/app/demo/_lib/attachments";
import { demoSites } from "@/app/demo/_lib/sites";

/**
 * 데모 사이트의 첨부 문서를 그 자리에서 만들어 내려보낸다.
 *
 * 파일을 레포에 커밋하지 않는 이유는 두 가지다. 바이너리가 diff 에 안 잡혀
 * 내용이 바뀐 것을 아무도 못 보고, 무엇보다 **본문과 첨부가 갈라진다** —
 * 공고 화면은 고쳤는데 첨부 엑셀은 옛 날짜인 상태가 데모 도중에 드러난다.
 * 내용은 Markdown 한 벌이고 포맷만 여기서 갈린다.
 */
export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  hwp: "application/x-hwp",
};

export async function GET(
  _request: Request,
  context: RouteContext<"/demo/[slug]/files/[file]">,
): Promise<Response> {
  const { slug, file } = await context.params;
  if (!demoSites.some((s) => s.slug === slug)) {
    return new Response("Not found", { status: 404 });
  }

  const name = decodeURIComponent(file);
  const doc = findFile(slug, name);
  if (!doc) return new Response("Not found", { status: 404 });

  const blocks = parseBlocks(doc.markdown);
  let bytes: Buffer;
  try {
    switch (doc.format) {
      case "pdf":
        bytes = await renderPdf(blocks, doc.title);
        break;
      case "xlsx":
        bytes = await renderXlsx(blocks, doc.title);
        break;
      case "docx":
        bytes = await renderDocx(blocks, doc.title);
        break;
      case "hwp":
        bytes = await renderHwp(blocks, "hwp");
        break;
    }
  } catch (error) {
    // HWP 는 별도 프로세스라 컨테이너 구성이 어긋나면 여기서만 죽는다.
    // 데모 도중 500 을 보여주느니 무엇이 없는지 적어 보낸다.
    console.error("[demo/files] 렌더 실패", name, error);
    return new Response(`파일을 생성하지 못했습니다: ${name}`, { status: 500 });
  }

  const body = new Uint8Array(bytes.length);
  body.set(bytes);
  return new Response(body, {
    headers: {
      "Content-Type": TYPES[doc.format],
      // 한글 파일명은 RFC 5987 로 보낸다. filename 만 쓰면 브라우저가 깨뜨린다.
      "Content-Disposition": `attachment; filename="${asciiName(name, doc.format)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}

/** 구형 클라이언트를 위한 대체 이름 — 한글을 빼고 확장자를 남긴다 */
function asciiName(name: string, format: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, "").replace(/^[_.\- ]+/, "");
  return ascii.length > 4 ? ascii : `attachment.${format}`;
}
