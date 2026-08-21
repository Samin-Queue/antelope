"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ChatPanel({ system }: { system?: string }) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat", body: { system } }),
  });

  const busy = status === "submitted" || status === "streaming";

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex-1 space-y-4 overflow-y-auto">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-muted-foreground">
            프로바이더 연결 확인용 채팅. 아무거나 보내보세요.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
              message.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted",
            )}
          >
            {message.parts
              .filter((part) => part.type === "text")
              .map((part, index) => (
                <span key={index}>{part.text}</span>
              ))}
          </div>
        ))}
        {error && (
          <p className="rounded-lg bg-destructive/10 px-4 py-3 font-mono text-xs text-destructive">
            {error.message}
          </p>
        )}
      </div>

      <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="메시지를 입력하세요"
          className="min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button
          size="icon"
          onClick={() => (busy ? stop() : submit())}
          disabled={!busy && input.trim().length === 0}
          aria-label={busy ? "중지" : "전송"}
        >
          {busy ? <Square /> : <ArrowUp />}
        </Button>
      </div>
    </div>
  );
}
