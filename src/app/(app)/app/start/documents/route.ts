import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { hasDb } from "@/lib/db";

import { rememberDocument } from "../_lib/documents";
import { artifactDir } from "../_lib/file-agent";
import type { Artifact } from "../_lib/types";

export const maxDuration = 60;

/**
 * 발급 서류 업로드.
 *
 * 올린 파일은 두 곳으로 간다 — 이번 신청에 쓸 임시 파일과, 다음 공고에서
 * 다시 묻지 않기 위한 **보관함**. 후자가 이 라우트의 존재 이유다.
 */
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  if (!hasDb()) return Response.json({ error: "DB 가 없습니다." }, { status: 503 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const label = String(form.get("label") ?? "").trim();
  const needKey = String(form.get("needKey") ?? "").trim();
  const runId = String(form.get("runId") ?? "").trim();
  const sourceNotice = String(form.get("sourceNotice") ?? "").trim() || null;

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "파일이 없습니다." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "파일이 5MB 를 넘습니다." }, { status: 413 });
  }
  if (!label || !needKey || !runId) {
    return Response.json(
      { error: "label·needKey·runId 가 필요합니다." },
      { status: 400 },
    );
  }

  const data = Buffer.from(await file.arrayBuffer());

  // 보관함이 먼저다. 이번 신청이 실패해도 서류는 남아야 한다.
  const stored = await rememberDocument(session.user.id, {
    label,
    filename: file.name,
    mime: file.type || "application/octet-stream",
    data,
    sourceNotice,
  });

  const dir = artifactDir(runId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, file.name);
  await writeFile(path, data);

  const artifact: Artifact = {
    needKey,
    label,
    filename: file.name,
    mime: file.type || "application/octet-stream",
    bytes: data.length,
    path,
    usedKeys: [],
    from: "user",
  };
  return Response.json({ artifact, stored: Boolean(stored) });
}
