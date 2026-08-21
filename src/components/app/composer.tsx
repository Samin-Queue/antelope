"use client";

import { useRef, useState } from "react";
import {
  ArrowUp,
  Building2,
  FileText,
  GraduationCap,
  Landmark,
  Link2,
  Paperclip,
  PartyPopper,
  Rocket,
  Trophy,
  X,
} from "lucide-react";

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

/**
 * 무엇을 넣을 수 있는지 예시로 보여준다.
 *
 * "공고" 를 좁게 잡으면 사용자가 정부지원사업만 떠올린다. 실제로는 자격을
 * 따지고 서류를 내는 모든 일이 같은 구조다 — 청약도, 수시도, 이벤트 응모도.
 */
const SUGGESTIONS = [
  {
    icon: Landmark,
    label: "정부지원사업",
    hint: "청년창업사관학교 13기 모집한다는데 나 되는지 봐줘",
  },
  {
    icon: Building2,
    label: "임대·분양 청약",
    hint: "행복주택 공고 캡쳐한 건데 내가 신청 자격 되는지 확인해줘",
  },
  {
    icon: Rocket,
    label: "스타트업 크레딧",
    hint: "https://www.cloudflare.com/forstartups/",
  },
  {
    icon: GraduationCap,
    label: "대학 수시",
    hint: "이 학과 수시 모집요강인데 내 생기부로 지원 가능한지 봐줘",
  },
  {
    icon: Trophy,
    label: "공모전·대회",
    hint: "이 해커톤 참가 요건이랑 제출물이 뭔지 정리해줘",
  },
  {
    icon: PartyPopper,
    label: "이벤트 응모",
    hint: "기대평 쓰면 추첨한다는 이벤트인데 뭘 해야 하는지 알려줘",
  },
];

export type ModelOption = { id: string; label: string; provider: string };

/**
 * 입력 상자.
 *
 * 에이전트 제품의 입구는 폼이 아니라 하나의 입력창이다. 무엇을 넣을지
 * 사용자가 고르게 하지 않는다 — 붙여넣은 것이 URL 이면 URL 로, 파일을 끌어다
 * 놓으면 파일로 알아서 처리한다.
 *
 * 랜딩 히어로와 워크스페이스가 **같은 컴포넌트**를 쓴다. 랜딩에서 본 상자와
 * 로그인 후 쓰는 상자가 다르면 그 자체가 거짓말이다.
 */
export function ComposerBox({
  models,
  onSubmit,
  className,
}: {
  /** 실제로 붙어 있는 모델. 서버에서 내려온 값이라 표시가 곧 사실이다 */
  models: ModelOption[];
  onSubmit: (input: ComposerSubmit) => void;
  className?: string;
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
    <div className={cn("w-full", className)}>
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
          "w-full rounded-3xl border bg-card p-3 transition-colors",
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
          onPaste={(event) => {
            // 캡쳐를 그대로 붙여넣는 것이 가장 흔한 입력이다.
            const image = Array.from(event.clipboardData.files).find((item) =>
              item.type.startsWith("image/"),
            );
            if (image) {
              event.preventDefault();
              setFile(image);
            }
          }}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="캡쳐를 붙여넣거나, 링크를 넣거나, 뭘 신청하려는지 그냥 말하세요"
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

      <p className="mt-6 text-center text-xs text-muted-foreground">
        자격을 따지고 서류를 내는 일이면 무엇이든 됩니다
      </p>
      <ul className="mt-3 flex flex-wrap justify-center gap-2">
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

/** 세션 시작 화면. 인사말 + 입력 상자. */
export function Composer({
  greeting,
  models,
  onSubmit,
}: {
  greeting: string;
  models: ModelOption[];
  onSubmit: (input: ComposerSubmit) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-10">
      <h1 className="text-center heading-display text-3xl text-balance sm:text-4xl">
        {greeting}
      </h1>
      <ComposerBox models={models} onSubmit={onSubmit} className="mt-10" />
    </div>
  );
}
