/**
 * HWP·HWPX 렌더러 — 별도 프로세스로 돈다.
 *
 * `@rhwp/core` 는 WASM 이라 Turbopack 이 옆의 `.wasm` 을 자기 로더로 감싸려다
 * `Can't resolve './rhwp_bg.js'` 로 빌드를 깬다. `serverExternalPackages` 도,
 * 동적 import 도 못 막는다 — 번들러가 이 파일을 **아예 안 보게** 하는 것이
 * 유일하게 확실한 길이다.
 *
 * 쓰기: `node scripts/render-hwp.mjs <hwp|hwpx> <출력경로>` + stdin 에 JSON `string[]`
 */
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const [format, outPath] = process.argv.slice(2);
if (!format || !outPath) {
  console.error("usage: render-hwp.mjs <hwp|hwpx> <out>");
  process.exit(2);
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const lines = JSON.parse(Buffer.concat(chunks).toString("utf8"));

const require = createRequire(import.meta.url);
const rhwp = require("@rhwp/core");
rhwp.initSync({ module: await readFile(require.resolve("@rhwp/core/rhwp_bg.wasm")) });

const doc = rhwp.HwpDocument.createEmpty();
// 빈 문서는 유효한 DocInfo 를 갖춰야 한컴이 연다. 라이브러리가 넣어 준다.
doc.createBlankDocument();
for (let index = 0; index < lines.length; index++) {
  // 0번 문단은 빈 문서에 이미 있다. 그 뒤부터 만들어 넣는다.
  if (index > 0) doc.insertParagraph(0, index);
  if (lines[index]) doc.insertText(0, index, 0, lines[index]);
}

const bytes = format === "hwp" ? doc.exportHwp() : doc.exportHwpx();
await writeFile(outPath, Buffer.from(bytes));
