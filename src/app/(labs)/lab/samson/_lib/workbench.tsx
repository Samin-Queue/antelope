"use client";

import { useState } from "react";
import { Download, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const resultSchema = z.object({
  filename: z.string(),
  markdown: z.string(),
  steps: z.array(z.string()),
});

const errorSchema = z.object({ error: z.string() });

type Result = z.infer<typeof resultSchema>;

function downloadName(filename: string): string {
  const stem = filename.replace(/\.[^/.]+$/, "").trim() || "samson-summary";
  return `${stem}-samson.md`;
}

export function SamsonWorkbench() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function summarize(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!file || pending) return;

    setPending(true);
    setResult(null);
    setError(null);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/lab/samson/ingest", { method: "POST", body });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const parsed = errorSchema.safeParse(payload);
        throw new Error(parsed.success ? parsed.data.error : `HTTP ${response.status}`);
      }

      setResult(resultSchema.parse(payload));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Samson 실행에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  function downloadMarkdown(): void {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([result.markdown], { type: "text/markdown" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = downloadName(result.filename);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
      <Card className="h-fit border-dashed bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" /> 입력 문서
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            PDF, 이미지, Office 문서, HWP 또는 Markdown 파일을 올리세요. 최대 25MB.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={summarize} className="space-y-4">
            <input
              id="samson-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.docx,.pptx,.xlsx,.hwp,.hwpx,.md,.txt"
              className="peer sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <label
              htmlFor="samson-file"
              className="flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-background px-5 text-center transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-focus-visible:outline-none hover:border-brand/50 hover:bg-brand/5"
            >
              <span className="rounded-lg bg-brand/10 p-3 text-brand">
                <Upload className="size-5" />
              </span>
              <span className="text-sm font-medium">
                {file ? file.name : "문서 선택"}
              </span>
              <span className="text-xs text-muted-foreground">
                {file
                  ? `${Math.ceil(file.size / 1024)}KB · 다른 문서 선택`
                  : "클릭해서 파일을 고르세요"}
              </span>
            </label>
            <Button type="submit" className="w-full" disabled={!file || pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {pending ? "Samson이 문서를 읽는 중" : "Markdown으로 요약"}
            </Button>
          </form>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-brand" /> Markdown 결과
            </CardTitle>
            {result && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadMarkdown}
              >
                <Download /> .md 저장
              </Button>
            )}
          </div>
          {result && (
            <div className="flex flex-wrap gap-1.5">
              {result.steps.map((step) => (
                <Badge key={step} variant="secondary" className="font-mono text-[11px]">
                  {step}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="min-h-96 pt-1">
          <p className="sr-only" role="status" aria-live="polite">
            {pending
              ? "Samson이 문서를 읽고 있습니다."
              : result
                ? "Markdown 요약이 준비되었습니다."
                : ""}
          </p>
          {pending && (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-brand" />
              <p>Parse와 판단 단계를 통과하는 중입니다.</p>
            </div>
          )}
          {!pending && !result && (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <FileText className="size-7 text-muted-foreground/50" />
              <p>요약 결과가 여기 Markdown 문서로 표시됩니다.</p>
            </div>
          )}
          {result && (
            <article className="max-w-none pt-5 text-sm leading-6 break-words [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8em] [&_h1]:mb-5 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:font-medium [&_li]:pl-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:my-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_th]:text-left [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markdown}</ReactMarkdown>
            </article>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
