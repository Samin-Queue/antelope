"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type ParseResult = {
  id: string | null;
  name: string;
  bytes: number;
  pages: number | null;
  markdown: string | null;
  html: string | null;
  elements: Array<{ page: number | null; category: string | null }>;
};

/** 트랙이 정해지면 이 스키마만 갈아끼운다. */
const DEFAULT_SCHEMA = `{
  "type": "object",
  "properties": {
    "title": { "type": "string", "description": "문서 제목" },
    "date": { "type": "string", "description": "작성일 (YYYY-MM-DD)" },
    "summary": { "type": "string", "description": "3문장 요약" }
  }
}`;

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx,.pptx,.xlsx,.hwp,.hwpx";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function countByCategory(elements: ParseResult["elements"]) {
  const counts = new Map<string, number>();
  for (const element of elements) {
    const key = element.category ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function DocumentWorkbench() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);

  const [schemaText, setSchemaText] = useState(DEFAULT_SCHEMA);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<unknown>(null);

  const [error, setError] = useState<string | null>(null);

  const pick = useCallback((next: File | null) => {
    setFile(next);
    setParsed(null);
    setExtracted(null);
    setError(null);
  }, []);

  async function parse() {
    if (!file || parsing) return;
    setParsing(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      if (enhanced) body.append("mode", "enhanced");
      const response = await fetch("/api/document", { method: "POST", body });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      setParsed(json as ParseResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setParsing(false);
    }
  }

  async function extract() {
    if (!file || extracting) return;
    setExtracting(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("schema", schemaText);
      const response = await fetch("/api/document/extract", { method: "POST", body });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      setExtracted(json.result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pick(event.dataTransfer.files[0] ?? null);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border bg-card/40",
        )}
      >
        <FileUp className="size-6 text-muted-foreground" />
        {file ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{file.name}</span>
            <Badge variant="secondary">{formatBytes(file.size)}</Badge>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => pick(null)}
              aria-label="선택 해제"
            >
              <X />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            PDF · 이미지 · DOCX · PPTX · XLSX · HWP 를 끌어다 놓거나 선택하세요
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => pick(event.target.files?.[0] ?? null)}
        />

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            파일 선택
          </Button>
          <Button onClick={parse} disabled={!file || parsing}>
            {parsing ? <Loader2 className="animate-spin" /> : null}
            {parsing ? "파싱 중" : "Document Parse"}
          </Button>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={enhanced}
              onChange={(event) => setEnhanced(event.target.checked)}
            />
            enhanced (표·차트 정확도 ↑)
          </label>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 font-mono text-xs break-words text-destructive">
          {error}
        </p>
      )}

      {parsed && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{parsed.pages ?? "?"} 페이지</Badge>
            <Badge variant="secondary">요소 {parsed.elements.length}</Badge>
            {parsed.id && <Badge variant="outline">DB 저장됨</Badge>}
            {countByCategory(parsed.elements)
              .slice(0, 6)
              .map(([category, count]) => (
                <Badge key={category} variant="outline">
                  {category} {count}
                </Badge>
              ))}
          </div>

          <Tabs defaultValue="markdown">
            <TabsList>
              <TabsTrigger value="markdown">렌더링</TabsTrigger>
              <TabsTrigger value="raw">Markdown</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="extract">정보 추출</TabsTrigger>
            </TabsList>

            <TabsContent value="markdown">
              <div className="prose-sm max-h-[32rem] max-w-none overflow-auto rounded-xl border border-border bg-card p-5 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:font-semibold [&_p]:mb-3 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {parsed.markdown ?? "(markdown 없음)"}
                </ReactMarkdown>
              </div>
            </TabsContent>

            <TabsContent value="raw">
              <pre className="max-h-[32rem] overflow-auto rounded-xl border border-border bg-card p-5 font-mono text-xs whitespace-pre-wrap">
                {parsed.markdown ?? "(없음)"}
              </pre>
            </TabsContent>

            <TabsContent value="html">
              <pre className="max-h-[32rem] overflow-auto rounded-xl border border-border bg-card p-5 font-mono text-xs whitespace-pre-wrap">
                {parsed.html ?? "(없음)"}
              </pre>
            </TabsContent>

            <TabsContent value="extract">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  JSON Schema 를 주면 문서에서 해당 필드만 뽑는다. 트랙이 정해지면 이
                  스키마만 바꾼다.
                </p>
                <Textarea
                  value={schemaText}
                  onChange={(event) => setSchemaText(event.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                />
                <Button onClick={extract} disabled={!file || extracting}>
                  {extracting ? <Loader2 className="animate-spin" /> : null}
                  {extracting ? "추출 중" : "Information Extract"}
                </Button>
                {extracted !== null && (
                  <pre className="max-h-96 overflow-auto rounded-xl border border-border bg-card p-5 font-mono text-xs">
                    {JSON.stringify(extracted, null, 2)}
                  </pre>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>
      )}
    </div>
  );
}
