/**
 * URL 파고들기.
 *
 * 링크 하나가 무엇인지 미리 알 수 없다. 응답을 보고 문서 파일이면 내려받고,
 * HTML 이면 본문과 링크를 남긴다. 이후 단계가 "파일인지 페이지인지" 를 다시
 * 판단하지 않도록 여기서 한 번에 갈라 둔다.
 */
export type IntakeFile = {
  name: string;
  blob: Blob;
  origin: "upload" | "url" | "crawl";
  url?: string;
};

export type Link = { url: string; text: string; isDocument: boolean };

export type Page = {
  url: string;
  title: string;
  text: string;
  links: Link[];
  /** 폼 라벨 글자. 신청 페이지면 입력 항목의 재료다 */
  formHints: string[];
  /** 플레이스홀더(예시 값). 항목이 아니라 칸을 찾을 때 쓰는 글자다 */
  placeholders: string[];
};

export type Drilled = { kind: "file"; file: IntakeFile } | { kind: "page"; page: Page };

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const DOCUMENT_EXT = /\.(pdf|hwp|hwpx|docx?|xlsx?|pptx?|png|jpe?g|zip)(\?|#|$)/i;
const DOCUMENT_MIME =
  /pdf|hwp|haansoft|msword|officedocument|ms-excel|ms-powerpoint|image\/(png|jpeg)|zip/i;
/** 공고 사이트의 첨부 링크는 확장자가 안 보이는 경우가 많다. 문구로도 본다 */
const ATTACH_HINT = /첨부|다운로드|download|attach|file|양식|서식|공고문/i;

export function looksLikeDocumentUrl(url: string): boolean {
  return DOCUMENT_EXT.test(url);
}

export async function drill(url: string, origin: IntakeFile["origin"]): Promise<Drilled> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 AntelopeBot/0.2",
      Accept: "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${url} → HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const disposition = response.headers.get("content-disposition") ?? "";
  const isDocument =
    DOCUMENT_MIME.test(contentType) ||
    (!/text\/html|application\/xhtml/i.test(contentType) &&
      (looksLikeDocumentUrl(url) || /attachment/i.test(disposition)));

  if (isDocument) {
    const blob = await response.blob();
    if (blob.size > MAX_FILE_BYTES) throw new Error(`${url} 파일이 25MB 를 넘습니다.`);
    return {
      kind: "file",
      file: { name: filenameOf(url, disposition, contentType), blob, origin, url },
    };
  }

  const buffer = await response.arrayBuffer();
  const html = new TextDecoder(charsetOf(contentType)).decode(
    buffer.slice(0, MAX_HTML_BYTES),
  );
  return {
    kind: "page",
    page: {
      url: response.url || url,
      title: titleOf(html),
      text: htmlToText(html),
      links: extractLinks(html, response.url || url),
      formHints: formHints(html),
      placeholders: placeholders(html),
    },
  };
}

function charsetOf(contentType: string): string {
  const match = contentType.match(/charset=([\w-]+)/i);
  const charset = match?.[1]?.toLowerCase() ?? "utf-8";
  // 한국 공공기관 사이트에 아직 남아 있다
  return charset === "euc-kr" || charset === "ks_c_5601-1987" ? "euc-kr" : charset;
}

function filenameOf(url: string, disposition: string, contentType: string): string {
  const star = disposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* 아래로 */
    }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  if (plain) return plain[1].trim();
  const tail = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  if (tail && /\.\w{2,5}$/.test(tail)) return tail;
  const ext = /pdf/i.test(contentType)
    ? "pdf"
    : /hwp/i.test(contentType)
      ? "hwp"
      : /wordprocessingml/i.test(contentType)
        ? "docx"
        : "bin";
  return `${tail || "document"}.${ext}`;
}

function titleOf(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]).replace(/\s+/g, " ").trim() : "";
}

/** 의존성 없이 본문만 남긴다. 정확도보다 견고함을 택했다. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|dt|dd|th|td)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

/** a[href] 목록. 상대 경로는 페이지 기준으로 푼다. 같은 URL 은 한 번만 */
function extractLinks(html: string, base: string): Link[] {
  const seen = new Set<string>();
  const links: Link[] = [];
  const pattern = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const href = decodeEntities(match[1]).trim();
    if (/^(javascript|mailto|tel):/i.test(href)) continue;
    let url: string;
    try {
      url = new URL(href, base).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    const text = htmlToText(match[2]).replace(/\s+/g, " ").trim().slice(0, 80);
    links.push({
      url,
      text,
      isDocument: looksLikeDocumentUrl(url) || ATTACH_HINT.test(text),
    });
    if (links.length >= 200) break;
  }
  return links;
}

/**
 * 폼의 라벨·플레이스홀더 글자.
 * 신청 페이지가 무엇을 묻는지는 여기 다 드러난다 — DOM 을 안 띄우고도 읽을 수 있다.
 */
export function formHints(html: string): string[] {
  const out = new Set<string>();
  const label = /<label\b[^>]*>([\s\S]*?)<\/label>/gi;
  let match: RegExpExecArray | null;
  while ((match = label.exec(html))) {
    const text = htmlToText(match[1]).replace(/\s+/g, " ").replace(/\*$/, "").trim();
    if (text && text.length <= 40) out.add(text);
  }
  const legend = /<legend\b[^>]*>([\s\S]*?)<\/legend>/gi;
  while ((match = legend.exec(html))) {
    const text = htmlToText(match[1]).replace(/\s+/g, " ").trim();
    if (text && text.length <= 40) out.add(text);
  }
  return [...out].slice(0, 80);
}

export function placeholders(html: string): string[] {
  const out = new Set<string>();
  const pattern = /placeholder\s*=\s*["']([^"']{1,60})["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    out.add(decodeEntities(match[1]).trim());
  }
  return [...out].slice(0, 60);
}

/** 문장 속 URL. 괄호·따옴표·문장부호로 끝나는 꼬리를 떼어낸다 */
export function urlsIn(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"'）)\]】]+/g) ?? [];
  return [...new Set(found.map((url) => url.replace(/[.,;:!?]+$/, "")))];
}
