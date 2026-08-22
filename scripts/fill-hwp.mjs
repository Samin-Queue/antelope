/**
 * HWP·HWPX 서식 채우기 — 별도 프로세스로 돈다 (`render-hwp.mjs` 와 같은 이유).
 *
 * 공고가 준 양식 파일을 열어 **표의 라벨 셀**을 찾고, 같은 행의 다음 빈 칸에
 * 값을 넣는다. 한글 신청 서식은 거의 예외 없이 「항목 | 값」 두 열 표다.
 *
 * 쓰기: `node scripts/fill-hwp.mjs <입력> <hwp|hwpx> <출력>` + stdin 에
 *       JSON `{ "라벨": "값" }`
 * 결과: stdout 에 JSON `{ filled: [{label, value}], skipped: [label] }`
 */
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const [inPath, format, outPath] = process.argv.slice(2);
if (!inPath || !format || !outPath) {
  console.error("usage: fill-hwp.mjs <in> <hwp|hwpx> <out>");
  process.exit(2);
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
/** @type {Record<string, string>} */
const values = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");

const require = createRequire(import.meta.url);
const rhwp = require("@rhwp/core");
rhwp.initSync({ module: await readFile(require.resolve("@rhwp/core/rhwp_bg.wasm")) });

const doc = new rhwp.HwpDocument(await readFile(inPath));

/** 라벨 비교용 — 공백·기호·「*」 같은 필수 표시를 턴다 */
const key = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[\s\-_·.,:()（）*※[\]]/g, "")
    .replace(/필수|선택/g, "")
    .trim();

const wanted = new Map(
  Object.entries(values).map(([label, value]) => [key(label), { label, value }]),
);
const filled = [];

for (const table of JSON.parse(doc.getControls()).filter((c) => c.ctrlId === "tbl")) {
  const cells = [];
  for (let index = 0; index < 200; index++) {
    try {
      const info = JSON.parse(doc.getCellInfo(0, table.para, table.controlIndex, index));
      const text = doc
        .getTextInCell(0, table.para, table.controlIndex, index, 0, 0, 300)
        .trim();
      cells.push({ index, ...info, text });
    } catch {
      break;
    }
  }

  for (const cell of cells) {
    if (!cell.text) continue;
    const hit = wanted.get(key(cell.text));
    if (!hit) continue;
    // 같은 행의 다음 칸이 비어 있어야 값 칸이다. 차 있으면 건드리지 않는다 —
    // 이미 적힌 것을 덮어쓰면 서식이 조용히 망가진다.
    const target = cells.find(
      (c) => c.row === cell.row && c.col === cell.col + 1 && !c.text,
    );
    if (!target) continue;
    doc.insertTextInCell(
      0,
      table.para,
      table.controlIndex,
      target.index,
      0,
      0,
      hit.value,
    );
    target.text = hit.value;
    filled.push({ label: hit.label, value: hit.value });
    wanted.delete(key(cell.text));
  }
}

const bytes = format === "hwp" ? doc.exportHwp() : doc.exportHwpx();
await writeFile(outPath, Buffer.from(bytes));
process.stdout.write(
  JSON.stringify({ filled, skipped: [...wanted.values()].map((v) => v.label) }),
);
