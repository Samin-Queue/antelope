"use client";

import { useRef, useState } from "react";
import { ArrowUp, CornerDownLeft, FileText, Link2, Paperclip, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ProviderMark } from "@/components/app/provider-mark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EXAMPLE_GROUPS, type Example } from "@/content/examples";

export type ComposerSubmit =
  | { kind: "text"; text: string }
  | { kind: "url"; url: string }
  /** 첨부한 공고문. 같이 적은 부탁이 있으면 `text` 로 함께 간다 */
  | { kind: "file"; file: File; text?: string };

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
  // 예시를 누르면 글이 담기는 곳으로 커서를 옮긴다 — 담기기만 하고 커서가
  // 그대로면 「눌렀는데 아무 일도 안 일어났다」로 읽힌다.
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const trimmed = text.trim();
  const isUrl = /^https?:\/\/\S+$/i.test(trimmed);
  /**
   * 보낼 수 있는 최소 길이.
   *
   * 20자였을 때 「이 공고 신청해줘」(9자) 같은 자연스러운 한국어 요청이 전부
   * 막혔다. 버튼만 흐려질 뿐 이유를 말해주지 않아서 눌러도 아무 일이 없는
   * 것처럼 보인다 — 실제로 "아무것도 안 된다" 는 제보가 여기였다.
   * 한국어는 글자당 정보량이 커서 8자면 의도가 드러난다.
   */
  const MIN_TEXT = 8;
  const ready = Boolean(file) || trimmed.length >= MIN_TEXT || isUrl;
  /** 왜 못 보내는지. 죽은 버튼만 두지 않는다 */
  const blocked =
    !ready && trimmed.length > 0 ? `${MIN_TEXT - trimmed.length}자 더 필요합니다` : null;

  /**
   * 예시를 고른다.
   *
   * 파일이 딸린 예시는 `public/` 에서 받아 그대로 첨부한다 — 사용자가 방금
   * 끌어다 놓은 것과 **같은 상태**여야 이후 흐름이 하나다.
   */
  async function pick(item: Example) {
    setText(item.input);
    setFile(null);
    textRef.current?.focus();
    if (!item.file) return;
    try {
      const response = await fetch(item.file.url);
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      setFile(new File([blob], item.file.name, { type: "application/pdf" }));
    } catch {
      // 못 받으면 문장만 남는다. 조사 단계가 제목으로 찾아가므로 죽지는 않는다.
      setText(`${item.label} 입주자모집공고 — ${item.input}`);
    }
  }

  function submit() {
    if (!ready) return;
    // 파일이 있어도 적은 글을 버리지 않는다 — 「이 공고 내가 되는지 봐줘」가
    // 파일만 남고 사라지면 무엇을 해 달라는지 서버가 알 수 없다.
    if (file) return onSubmit({ kind: "file", file, text: trimmed || undefined });
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
          ref={textRef}
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
          {blocked && <span className="text-xs text-muted-foreground">{blocked}</span>}

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
        자격을 따지고 서류를 내는 일이면 무엇이든 됩니다. 아래 예제로 바로 시작해 보세요.
      </p>

      {/* 종류 이름만 있는 알약은 눌러도 무슨 일이 벌어지는지 알 수 없었다.
          실재하는 공고를 그대로 넣는다 — 누르면 입력창에 담기고, 보내기만 하면 된다 */}
      <Tabs defaultValue={EXAMPLE_GROUPS[0].id} className="mt-3 gap-3">
        <TabsList variant="line" className="w-full flex-wrap justify-center gap-4">
          {EXAMPLE_GROUPS.map((group) => (
            <TabsTrigger
              key={group.id}
              value={group.id}
              className="h-8 flex-none px-0.5 text-sm font-normal"
            >
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {EXAMPLE_GROUPS.map((group) => (
          <TabsContent key={group.id} value={group.id}>
            <ItemGroup className="gap-1.5">
              {group.items.map((item) => (
                <Item
                  key={item.label}
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors hover:border-brand/40 hover:bg-muted/50"
                  render={<button type="button" onClick={() => pick(item)} />}
                >
                  {/* 섞여 있는 탭에서는 무엇을 누르는지 유형이 먼저 보여야 한다 */}
                  {group.id === "picks" && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {item.kind}
                    </Badge>
                  )}
                  <ItemContent className="min-w-0 gap-0">
                    <ItemTitle className="truncate font-normal">{item.label}</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    {item.file ? (
                      <Paperclip className="size-3.5 text-muted-foreground" />
                    ) : (
                      <CornerDownLeft className="size-3.5 text-muted-foreground" />
                    )}
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/** 세션 시작 화면. 인사말 + 입력 상자. */
export function Composer({
  greeting,
  user,
  models,
  onSubmit,
}: {
  greeting: string;
  /** 있으면 인사말 왼쪽에 아바타를 붙인다. 로그인 전에는 없다 */
  user?: { name?: string | null; email?: string | null; image?: string | null } | null;
  models: ModelOption[];
  onSubmit: (input: ComposerSubmit) => void;
}) {
  const label = user?.name || user?.email || "";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-10">
      <h1 className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center heading-display text-3xl text-balance sm:text-4xl">
        {user && (
          <Avatar className="size-7 sm:size-8">
            {user.image ? <AvatarImage src={user.image} alt={label} /> : null}
            <AvatarFallback className="text-sm">
              {label.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        {greeting}
      </h1>
      <ComposerBox models={models} onSubmit={onSubmit} className="mt-10" />
    </div>
  );
}
