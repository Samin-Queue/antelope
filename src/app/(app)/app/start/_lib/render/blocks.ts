/**
 * Markdown → 블록 트리.
 *
 * 파일 에이전트는 본문을 Markdown 으로 **한 번만** 쓴다. 포맷은 그 뒤의 문제다 —
 * PDF·HWP·DOCX·XLSX 렌더러가 같은 트리를 각자 옮긴다. 포맷마다 프롬프트를
 * 따로 두면 같은 문서가 포맷별로 다른 내용이 된다.
 *
 * Markdown 라이브러리를 넣지 않는다. 입력이 우리 모델의 출력이라 문법 범위가
 * 좁고, 렌더러가 필요로 하는 건 구조뿐이다.
 */
export type Inline = { text: string; bold?: boolean; code?: boolean; href?: string };

export type Block =
  | { kind: "heading"; level: number; spans: Inline[] }
  | { kind: "para"; spans: Inline[] }
  | { kind: "list"; ordered: boolean; depth: number; spans: Inline[] }
  | { kind: "quote"; spans: Inline[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let table: string[][] | null = null;

  const closeTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    blocks.push({ kind: "table", head, rows });
    table = null;
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (/^\|.*\|$/.test(trimmed)) {
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      // 구분선(|---|---|)은 표의 일부가 아니다
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      (table ??= []).push(cells);
      continue;
    }
    closeTable();

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        spans: inline(heading[2]),
      });
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      blocks.push({ kind: "quote", spans: inline(quote[1]) });
      continue;
    }

    // 들여쓴 목록은 한 단계 아래로. 모델이 항목 밑에 항목을 매다는 일이 흔하다.
    const depth = /^\s+[-*\d]/.test(raw) ? 1 : 0;

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      blocks.push({ kind: "list", ordered: false, depth, spans: inline(bullet[1]) });
      continue;
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      blocks.push({ kind: "list", ordered: true, depth, spans: inline(numbered[1]) });
      continue;
    }

    if (trimmed) blocks.push({ kind: "para", spans: inline(trimmed) });
  }
  closeTable();
  return blocks;
}

/** 굵게·코드·링크만 안다. 그 밖은 글자 그대로 둔다. */
function inline(text: string): Inline[] {
  const spans: Inline[] = [];
  const pattern = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\[(.+?)\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) spans.push({ text: text.slice(last, match.index) });
    if (match[2] !== undefined) spans.push({ text: match[2], bold: true });
    else if (match[4] !== undefined) spans.push({ text: match[4], code: true });
    else if (match[6] !== undefined) spans.push({ text: match[6], href: match[7] });
    last = pattern.lastIndex;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.length ? spans : [{ text }];
}

/** 서식을 버리고 글자만. hwp·xlsx 처럼 인라인 서식이 값어치 없는 곳에서 쓴다. */
export function plain(spans: Inline[]): string {
  return spans.map((span) => span.text).join("");
}
