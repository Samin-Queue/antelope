"use client";

import { useState } from "react";
import { Download, Files, Loader2, Sparkles, Upload } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const responseSchema = z.object({
  files: z.array(z.string()),
  json: z.unknown(),
  step: z.string(),
});

const errorSchema = z.object({ error: z.string() });

type Result = z.infer<typeof responseSchema>;

export function MichaelWorkbench() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function analyze(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (files.length === 0 || pending) return;
    setPending(true);
    setResult(null);
    setError(null);
    try {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      const response = await fetch("/lab/michael/ingest", { method: "POST", body });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorSchema.safeParse(payload);
        throw new Error(parsed.success ? parsed.data.error : `HTTP ${response.status}`);
      }
      setResult(responseSchema.parse(payload));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Michael 실행에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  function downloadJson(): void {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result.json, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "michael-application-fields.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
      <Card className="h-fit border-dashed bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Files className="size-4 text-brand" /> 입력 문서
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            신청 공고와 양식·증빙 안내를 함께 선택하세요.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={analyze} className="space-y-4">
            <input
              id="michael-files"
              type="file"
              multiple
              className="peer sr-only"
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
            <label
              htmlFor="michael-files"
              className="flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-background px-5 text-center transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-focus-visible:outline-none hover:border-brand/50 hover:bg-brand/5"
            >
              <span className="rounded-lg bg-brand/10 p-3 text-brand">
                <Upload className="size-5" />
              </span>
              <span className="text-sm font-medium">
                {files.length ? `${files.length}개 문서 선택됨` : "문서 여러 개 선택"}
              </span>
              <span className="text-xs text-muted-foreground">
                공고는 반드시 하나 포함하세요
              </span>
            </label>
            <Button
              type="submit"
              className="w-full"
              disabled={files.length === 0 || pending}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {pending ? "Michael이 양식을 설계하는 중" : "JSON 필드 만들기"}
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
            <CardTitle>JSON 필드 목록</CardTitle>
            {result && (
              <Button type="button" variant="outline" size="sm" onClick={downloadJson}>
                <Download /> .json 저장
              </Button>
            )}
          </div>
          {result && (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="font-mono text-[11px]">
                {result.step}
              </Badge>
              {result.files.map((file) => (
                <Badge key={file} variant="outline" className="max-w-40 truncate">
                  {file}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="min-h-96 pt-1">
          <p className="sr-only" role="status" aria-live="polite">
            {pending
              ? "Michael이 신청 필드를 분석하고 있습니다."
              : result
                ? "JSON 필드 목록이 준비되었습니다."
                : ""}
          </p>
          {pending && (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-brand" />
              <p>문서를 분류하고 필드를 추출하는 중입니다.</p>
            </div>
          )}
          {!pending && !result && (
            <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <Files className="size-7 text-muted-foreground/50" />
              <p>신청 양식의 JSON 필드 목록이 여기 표시됩니다.</p>
            </div>
          )}
          {result && (
            <pre className="mt-5 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-5 break-words whitespace-pre-wrap">
              {JSON.stringify(result.json, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
