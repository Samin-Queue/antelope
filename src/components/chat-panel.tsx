"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, MessagesSquare, Square, Wrench } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";

export function ChatPanel({
  system,
  api = "/api/chat",
  /** 빈 화면 위쪽 마크. 안 주면 채팅 아이콘 */
  emptyMedia,
  emptyTitle,
  empty = "프로바이더 연결 확인용 채팅. 아무거나 보내보세요.",
  placeholder = "메시지를 입력하세요",
  /** 처음 화면에 깔아 둘 예시 질문. 누르면 그대로 보낸다 */
  suggestions,
  /**
   * 요청마다 실려 갈 값. **함수로 받는다** — 값으로 받으면 전송 시점이 아니라
   * 이 컴포넌트가 처음 그려진 순간의 것이 굳는다(화면 경로가 그렇다).
   */
  body,
  /** 도구 이름 → 화면에 쓸 말. 없는 이름은 그대로 보여준다 */
  toolLabels,
  /** 입력 상자 안 왼쪽 아래에 얹을 것. 보낼 때 같이 갈 것을 여기서 켠다 */
  composerAddon,
}: {
  system?: string;
  api?: string;
  emptyMedia?: React.ReactNode;
  emptyTitle?: string;
  empty?: React.ReactNode;
  placeholder?: string;
  suggestions?: readonly string[];
  body?: () => Record<string, unknown>;
  toolLabels?: Record<string, string>;
  composerAddon?: React.ReactNode;
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({
      api,
      body: () => ({ ...(system ? { system } : {}), ...(body?.() ?? {}) }),
    }),
  });

  const busy = status === "submitted" || status === "streaming";

  // 스트리밍 중에는 글자가 계속 늘어난다. 바닥에 붙여 두지 않으면 사용자가
  // 매 토큰마다 스크롤을 내려야 한다.
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  function send(text: string) {
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && (
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">{emptyMedia ?? <MessagesSquare />}</EmptyMedia>
              {emptyTitle && <EmptyTitle>{emptyTitle}</EmptyTitle>}
              <EmptyDescription>{empty}</EmptyDescription>
            </EmptyHeader>
            {suggestions && suggestions.length > 0 && (
              <EmptyContent className="flex-row flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="h-auto rounded-full px-3 py-1.5 text-xs font-normal whitespace-normal"
                    onClick={() => send(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </EmptyContent>
            )}
          </Empty>
        )}

        {messages.map((message) => {
          const text = message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("");
          // 무엇을 찾아보고 답했는지 감추지 않는다. 「지어내지 않는다」가 이
          // 제품의 주장인데 근거를 조회한 사실이 화면에 안 보이면 증명이 안 된다.
          const calls = message.parts.filter((part) => part.type.startsWith("tool-"));

          return (
            <div key={message.id} className="flex flex-col gap-1.5">
              {calls.map((part, index) => {
                const name = part.type.slice("tool-".length);
                const done = "state" in part && part.state === "output-available";
                return (
                  <Item key={index} variant="muted" size="xs" className="w-fit">
                    <ItemMedia variant="icon">
                      {done ? <Wrench className="text-muted-foreground" /> : <Spinner />}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="text-xs font-normal text-muted-foreground">
                        {toolLabels?.[name] ?? name} {done ? "확인함" : "찾는 중"}
                      </ItemTitle>
                    </ItemContent>
                  </Item>
                );
              })}

              {text &&
                (message.role === "user" ? (
                  // ⚠ `w-fit` 이 없으면 블록이 `max-w` 까지 늘어난다 — 「안녕」 한 마디가
                  // 패널 폭의 85% 를 차지하던 것이 그래서였다.
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap text-primary-foreground">
                    {text}
                  </div>
                ) : (
                  // 모델은 목록·표·굵은 글씨로 답한다. 평문으로 두면 `**` 와 `|` 가
                  // 그대로 보인다 — 좁은 열에서는 그게 답을 못 읽게 만든다.
                  <div className="w-fit max-w-[92%] space-y-2 rounded-2xl bg-muted px-3.5 py-2 text-sm leading-relaxed [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_pre]:overflow-x-auto [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_td]:border [&_td]:border-border [&_td]:px-1.5 [&_td]:py-0.5 [&_th]:border [&_th]:border-border [&_th]:px-1.5 [&_th]:py-0.5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                  </div>
                ))}
            </div>
          );
        })}

        {status === "submitted" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3.5" />
            생각하는 중
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-destructive/10 px-4 py-3 font-mono text-xs text-destructive">
            {error.message}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <InputGroup className="rounded-2xl">
        <InputGroupTextarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(input.trim());
            }
          }}
          rows={1}
          placeholder={placeholder}
          className="max-h-40 min-h-11"
        />
        <InputGroupAddon align="block-end">
          {composerAddon}
          <InputGroupButton
            variant="default"
            size="icon-sm"
            className="ml-auto rounded-full"
            onClick={() => (busy ? stop() : send(input.trim()))}
            disabled={!busy && input.trim().length === 0}
            aria-label={busy ? "중지" : "전송"}
          >
            {busy ? <Square /> : <ArrowUp />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
