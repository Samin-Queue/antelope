import { extractNotice, toPlainText, type IngestSource } from "../_lib/extract";
import { hasStudioAgent, runStudio } from "../_lib/studio";

export const maxDuration = 180;

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * 입력 어댑터. 파일·URL·자연어를 하나의 「공고 객체」로 수렴시킨다.
 * 이후 파이프라인은 입력 종류를 알 필요가 없다.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const kind = form.get("kind");

  try {
    let source: IngestSource;
    let raw: File | string;

    if (kind === "file") {
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return Response.json({ error: "파일이 없습니다." }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return Response.json({ error: "파일이 25MB 를 넘습니다." }, { status: 413 });
      }
      source = { kind: "file", name: file.name };
      raw = file;

      // 파일은 Studio 파이프라인이 처리한다 — 트랙 요건이 문서 처리의 핵심을
      // Studio 가 맡는 것이다. 에이전트가 없을 때만 v1 직접 호출로 떨어진다.
      if (hasStudioAgent()) {
        const result = await runStudio(file, file.name);
        return Response.json({
          source,
          via: `upstage/studio (${result.steps.join(" → ")})`,
          chars: result.markdown?.length ?? 0,
          notice: result.notice,
          citations: result.citations,
        });
      }
    } else if (kind === "url") {
      const url = String(form.get("url") ?? "").trim();
      if (!/^https?:\/\//i.test(url)) {
        return Response.json({ error: "http(s) URL 을 입력하세요." }, { status: 400 });
      }
      source = { kind: "url", url };
      raw = url;
    } else if (kind === "text") {
      const text = String(form.get("text") ?? "").trim();
      if (text.length < 20) {
        return Response.json({ error: "설명이 너무 짧습니다." }, { status: 400 });
      }
      source = { kind: "text" };
      raw = text;
    } else {
      return Response.json(
        { error: "kind 는 file | url | text 중 하나입니다." },
        { status: 400 },
      );
    }

    const { text, via } = await toPlainText(raw, kind as "file" | "url" | "text");
    if (text.trim().length < 20) {
      return Response.json(
        { error: "본문을 읽지 못했습니다. 다른 형식으로 시도해 보세요." },
        { status: 422 },
      );
    }

    const notice = await extractNotice(text, source);
    return Response.json({ source, via, chars: text.length, notice });
  } catch (error) {
    // 스키마 불일치일 때 모델이 실제로 무엇을 뱉었는지 보여준다. 이게 없으면
    // "response did not match schema" 만 보고 원인을 추측하게 된다.
    const detail = error as { text?: string; cause?: { message?: string } };
    return Response.json(
      {
        error: error instanceof Error ? error.message : String(error),
        modelOutput: detail.text?.slice(0, 2000) ?? null,
        cause: detail.cause?.message?.slice(0, 800) ?? null,
      },
      { status: 502 },
    );
  }
}
