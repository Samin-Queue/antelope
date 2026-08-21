"use client";

import { useRef, useState } from "react";
import { ArrowUp, FileText, Link2, Paperclip, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ProviderMark } from "@/components/app/provider-mark";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ComposerSubmit =
  | { kind: "text"; text: string }
  | { kind: "url"; url: string }
  | { kind: "file"; file: File };

const SUGGESTIONS = [
  { icon: Sparkles, label: "공고문 분석", hint: "지원사업 공고를 넣어보세요" },
  { icon: Link2, label: "링크로 시작", hint: "https://www.k-startup.go.kr/..." },
  { icon: FileText, label: "말로 설명", hint: "포항에서 하는 청년 창업 지원사업인데..." },
];

/**
 * 세션 시작 화면.
 *
 * 에이전트 제품의 입구는 폼이 아니라 하나의 입력창이다. 무엇을 넣을지
 * 사용자가 고르게 하지 않는다 — 붙여넣은 것이 URL 이면 URL 로, 파일을 끌어다
 * 놓으면 파일로 알아서 처리한다.
 */
export type ModelOption = { id: string; label: string; provider: string };

export function Composer({
  greeting,
  models,
  onSubmit,
}: {
  greeting: string;
  /** 실제로 붙어 있는 모델. 서버에서 내려온 값이라 표시가 곧 사실이다 */
  models: ModelOption[];
  onSubmit: (input: ComposerSubmit) => void;
}) {
  const [model, setModel] = useState(models[0]?.id ?? "");
  const selected = models.find((item) => item.id === model) ?? models[0];
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const trimmed = text.trim();
  const isUrl = /^https?:\/\/\S+$/i.test(trimmed);
  const ready = Boolean(file) || trimmed.length >= 20 || isUrl;

  function submit() {
    if (!ready) return;
    if (file) return onSubmit({ kind: "file", file });
    if (isUrl) return onSubmit({ kind: "url", url: trimmed });
    onSubmit({ kind: "text", text: trimmed });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-20">
      <h1 className="text-center heading-display text-3xl text-balance sm:text-4xl">
        {greeting}
      </h1>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped) setFile(dropped);
        }}
        className={cn(
          "mt-10 w-full rounded-3xl border bg-card p-3 transition-colors",
          dragging ? "border-brand bg-brand/5" : "border-border",
        )}
      >
        {file && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">
            <FileText className="size-4 text-brand" />
            <span className="truncate">{file.name}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="ml-auto"
              aria-label="첨부 취소"
              onClick={() => setFile(null)}
            >
              <X />
            </Button>
          </div>
        )}

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="공고문을 올리거나, 링크를 붙여넣거나, 어떤 사업인지 그냥 설명하세요"
          className="w-full resize-none bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground"
        />

        <div className="flex items-center gap-2 px-1">
          <input
            ref={inputRef}
            type="file"
            accept=".hwp,.hwpx,.pdf,.png,.jpg,.jpeg,.docx"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="파일 첨부"
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip />
          </Button>
          {isUrl && !file && (
            <span className="flex items-center gap-1 text-xs text-brand">
              <Link2 className="size-3" />
              링크로 인식됨
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {models.length > 0 && (
              <Select value={model} onValueChange={(value) => setModel(value ?? "")}>
                <SelectTrigger
                  size="sm"
                  className="gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-xs text-muted-foreground shadow-none transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-0"
                >
                  {selected && <ProviderMark provider={selected.provider} />}
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {models.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <span className="flex items-center gap-2">
                        <ProviderMark provider={item.provider} />
                        {item.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="icon"
              className="rounded-full"
              aria-label="시작"
              disabled={!ready}
              onClick={submit}
            >
              <ArrowUp />
            </Button>
          </div>
        </div>
      </div>

      <ul className="mt-6 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={() => setText(item.hint)}
              className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
            >
              <item.icon className="size-3.5" />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
