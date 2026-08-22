import { mkdir, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import { documentKey, rememberDocument } from "@/app/(app)/app/start/_lib/documents";
import { MAX_FILE_BYTES } from "@/app/(app)/app/start/_lib/fetch";
import { artifactDir, artifactPath } from "@/app/(app)/app/start/_lib/file-agent";
import type { Need } from "@/app/(app)/app/start/_lib/types";

import type { IncomingFile } from "./channel";

/**
 * 스레드에 올라온 파일.
 *
 * 두 자리에서 온다 — 처음 일을 시킬 때 붙인 **공고 파일**과, 되묻는 중에 주는
 * **제출 서류**. 후자는 두 곳에 남는다: 이번 신청이 쓸 임시 파일과, 다음
 * 공고에서 다시 묻지 않기 위한 보관함.
 */

/** 서류 첨부 상한. 보관함에 base64 로 들어가므로 공고 파일(25MB)보다 작다 */
const MAX_DOC_BYTES = 5 * 1024 * 1024;

/** 공고로 쓸 첨부 하나를 고른다. 파이프라인 입력은 파일 하나다 */
export async function pickNotice(
  files: IncomingFile[],
): Promise<{ file: File | null; tooBig: string[] }> {
  const tooBig = files.filter((f) => f.bytes > MAX_FILE_BYTES).map((f) => f.name);
  const usable = files.find((f) => f.bytes <= MAX_FILE_BYTES);
  if (!usable) return { file: null, tooBig };
  const blob = await usable.download();
  return {
    file: new File([blob], usable.name, { type: usable.mime }),
    tooBig,
  };
}

/** 아직 안 받은 서류 항목 */
export function missingFiles(needs: Need[]): Need[] {
  return needs.filter((need) => need.kind === "file" && !need.value?.trim());
}

/**
 * 파일이 어느 항목의 것인가.
 *
 * ⚠ `documentKey("제출 서류") === ""` 다 — NOISE 가 두 낱말을 다 지운다.
 * 빈 키를 그대로 쓰면 `includes` 가 항상 참이라 **아무 파일이나 그 항목에
 * 붙는다.** 빈 키는 매칭에서 제외한다.
 */
export function matchNeed(
  filename: string,
  text: string,
  candidates: Need[],
): Need | null {
  if (candidates.length === 0) return null;

  const base = filename.replace(/\.[A-Za-z0-9]{1,8}$/, "");
  const fileKey = documentKey(base);
  if (fileKey) {
    const hit = candidates.find((need) => {
      const key = documentKey(need.label);
      return key && (key === fileKey || fileKey.includes(key) || key.includes(fileKey));
    });
    if (hit) return hit;
  }

  // 파일명이 「스캔0001.pdf」 같을 때. 사람이 함께 쓴 말에서 찾는다.
  const said = documentKey(text);
  if (said) {
    const hit = candidates.find((need) => {
      const key = documentKey(need.label);
      return key && said.includes(key);
    });
    if (hit) return hit;
  }

  // 받을 서류가 하나뿐이면 그것이다. 둘 이상이면 짐작하지 않고 되묻는다.
  return candidates.length === 1 ? candidates[0] : null;
}

export type TakenFile = { need: Need; filename: string };

/**
 * 서류를 받아 둔다.
 *
 * 임시 파일과 보관함 **둘 다** 쓴다. 보관함이 먼저다 — 이번 신청이 실패해도
 * 서류는 남아야 한다(`documents/route.ts` 가 같은 순서를 지킨다).
 */
export async function takeFiles(args: {
  files: IncomingFile[];
  text: string;
  needs: Need[];
  runId: string | null;
  userId: string;
  sourceNotice: string | null;
}): Promise<{ taken: TakenFile[]; unmatched: string[]; tooBig: string[] }> {
  const taken: TakenFile[] = [];
  const unmatched: string[] = [];
  const tooBig: string[] = [];
  // 매칭에서 이미 쓴 항목은 뺀다. 파일 둘이 같은 칸에 들어가면 하나가 사라진다.
  const pool = [...missingFiles(args.needs)];

  for (const file of args.files) {
    if (file.bytes > MAX_DOC_BYTES) {
      tooBig.push(file.name);
      continue;
    }
    const need = matchNeed(file.name, args.text, pool);
    if (!need) {
      unmatched.push(file.name);
      continue;
    }

    try {
      const blob = await file.download();
      const data = Buffer.from(await blob.arrayBuffer());

      await rememberDocument(args.userId, {
        label: need.label,
        filename: file.name,
        mime: file.mime,
        data,
        sourceNotice: args.sourceNotice,
      });

      let stored = file.name;
      if (args.runId) {
        const dir = artifactDir(args.runId);
        await mkdir(dir, { recursive: true });
        // 경로는 **서버가 만든다.** 파일명은 채널에서 온 값이라 그대로 join 하면
        // `../../` 하나로 컨테이너 아무 데나 쓴다.
        const path = artifactPath(dir, file.name);
        await writeFile(path, data);
        stored = basename(path);
      }

      pool.splice(pool.indexOf(need), 1);
      taken.push({ need, filename: stored });
    } catch (error) {
      console.error("[relay/files] 저장 실패", file.name, error);
      unmatched.push(file.name);
    }
  }

  return { taken, unmatched, tooBig };
}

/** 받은 서류를 마스터 테이블에 표시한다. 값은 파일명이다 */
export function applyFiles(needs: Need[], taken: TakenFile[]): Need[] {
  const byKey = new Map(taken.map((t) => [t.need.key, t.filename]));
  return needs.map((need) => {
    const filename = byKey.get(need.key);
    return filename && !need.value?.trim()
      ? { ...need, value: filename, from: "user" as const }
      : need;
  });
}
