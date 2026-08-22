"use client";

import { useState } from "react";
import { CornerDownLeft, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * 도중에 끼어드는 자리.
 *
 * 에이전트가 도는 것을 보다가 「그건 다르게 해줘」 라고 말할 수 있어야 한다.
 * 그러지 못하면 사용자는 끝날 때까지 구경만 하다 결과를 통째로 버리게 된다.
 *
 * 기본은 **다음 단계에 전달**이다. 지금 도는 조작을 끊으면 반쯤 채운 폼이
 * 남는다 — 단계 경계에서 받는 편이 안전하고, 급할 때만 즉시로 끊는다.
 */
export function SteerBox({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string, mode: "now" | "next") => void;
}) {
  const [text, setText] = useState("");

  const send = (mode: "now" | "next") => {
    const value = text.trim();
    if (!value) return;
    onSend(value, mode);
    setText("");
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          send(event.metaKey || event.ctrlKey ? "now" : "next");
        }}
        placeholder={
          disabled
            ? "실행 중일 때 지시할 수 있습니다"
            : "에이전트에게 지시 — 예: 주소는 본사로 써줘"
        }
        className="h-9"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || !text.trim()}
        onClick={() => send("next")}
        title="지금 하는 일을 마치고 전달한다"
      >
        <CornerDownLeft />
        전달
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={disabled || !text.trim()}
        onClick={() => send("now")}
        title="지금 하는 일을 끊고 즉시 전달한다"
        className={cn(text.trim() && "text-destructive")}
      >
        <Zap />
        즉시
      </Button>
    </div>
  );
}
