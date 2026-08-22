import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { plain, type Block } from "./blocks";

/**
 * HWP · HWPX — `@rhwp/core` (Rust + WASM), **별도 프로세스**로 돌린다.
 *
 * 한글 문서를 쓸 수 있는 오픈 구현이다. `.hwp` 는 바이너리 복합문서라 직접
 * 만들기 어렵고, `.hwpx` 는 ZIP+XML(OWPML, KS X 6101)이라 열려 있다 — 이
 * 라이브러리가 둘 다 낸다.
 *
 * ⚠ 왜 자식 프로세스인가: Turbopack 이 패키지 옆의 `.wasm` 을 자기 로더로
 * 감싸려다 `Can't resolve './rhwp_bg.js'` 로 빌드를 깬다.
 * `serverExternalPackages` 도, 런타임 조합 import 도 못 막았다 — 번들러가
 * `scripts/render-hwp.mjs` 를 **아예 안 보는** 것이 유일하게 확실한 길이다.
 */
const run = promisify(execFile);

export type HwpFormat = "hwp" | "hwpx";

export async function renderHwp(blocks: Block[], format: HwpFormat): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "antelope-hwp-"));
  const out = join(dir, `doc.${format}`);
  const script = join(process.cwd(), "scripts", "render-hwp.mjs");

  try {
    const child = run("node", [script, format, out], {
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    child.child.stdin?.end(JSON.stringify(toLines(blocks)));
    await child;
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * 블록을 줄로 편다.
 *
 * 표는 `createTable` 로 진짜 표를 만들 수도 있지만, 셀 좌표를 다루다 한 칸이
 * 어긋나면 문서 전체가 무너진다. 지금은 글자로 편다 — 내용이 남는 쪽이 낫다.
 */
function toLines(blocks: Block[]): string[] {
  const lines: string[] = [];
  let counter = 0;

  for (const block of blocks) {
    if (block.kind !== "list") counter = 0;
    switch (block.kind) {
      case "heading":
        if (lines.length) lines.push("");
        lines.push(plain(block.spans));
        break;
      case "para":
        lines.push(plain(block.spans));
        break;
      case "quote":
        lines.push(`※ ${plain(block.spans)}`);
        break;
      case "list": {
        const indent = "    ".repeat(block.depth);
        const marker = block.ordered ? `${++counter}. ` : "· ";
        lines.push(`${indent}${marker}${plain(block.spans)}`);
        break;
      }
      case "table":
        lines.push(block.head.join(" | "));
        for (const row of block.rows) lines.push(row.join(" | "));
        break;
    }
  }
  return lines;
}
