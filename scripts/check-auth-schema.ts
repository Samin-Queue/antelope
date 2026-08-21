/**
 * better-auth 런타임이 기대하는 필드와 Drizzle 스키마를 대조한다.
 *
 * better-auth 1.7.1 은 CLI 생성물에 account.issuer 를 넣지 않으면서 런타임에서는
 * 그 컬럼으로 조회한다. 누락되면 OAuth 콜백이 SQL 구문 오류로 죽는데, 로컬에서는
 * 콜백을 타지 않아 드러나지 않는다. CI 에서 매번 확인한다.
 */
import { getAuthTables } from "better-auth/db";

import { auth } from "@/lib/auth";
import * as schema from "@/lib/db/schema";

type TableDef = { modelName: string; fields: Record<string, unknown> };

const tables = getAuthTables(auth.options as never) as Record<string, TableDef>;
const generated = schema as unknown as Record<string, Record<string, unknown>>;

let failed = false;

for (const [model, def] of Object.entries(tables)) {
  const table = generated[def.modelName] ?? generated[model];
  if (!table) {
    console.error(`✗ [${model}] 테이블이 스키마에 없습니다 (modelName=${def.modelName})`);
    failed = true;
    continue;
  }
  const have = new Set(Object.keys(table));
  const missing = Object.keys(def.fields).filter((field) => !have.has(field));
  if (missing.length > 0) {
    console.error(`✗ [${model}] 누락된 필드: ${missing.join(", ")}`);
    failed = true;
  } else {
    console.log(`✓ [${model}] ${Object.keys(def.fields).length}개 필드 일치`);
  }
}

if (failed) {
  console.error(
    "\nbetter-auth 스키마가 어긋났습니다. src/lib/db/auth-schema.ts 를 고치고 pnpm db:push 하세요.",
  );
  process.exit(1);
}
process.exit(0);
