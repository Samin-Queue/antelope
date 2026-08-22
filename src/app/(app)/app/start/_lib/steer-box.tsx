"use client";

import { useState } from "react";
import { CornerDownLeft, RotateCw, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * 도중에 끼어드는 자리, 그리고 멈춘 뒤 이어 붙이는 자리.
 *
 * 에이전트가 도는 것을 보다가 「그건 다르게 해줘」 라고 말할 수 있어야 한다.
 * 그러지 못하면 사용자는 끝날 때까지 구경만 하다 결과를 통째로 버리게 된다.
 * 멈춘 뒤에도 같다 — 「읽을 내용이 부족하다」로 끝난 화면에서 상자가 죽어
 * 있으면, 남은 선택지는 화면을 버리고 처음부터 다시 시작하는 것뿐이다.
 *
 * 기본은 **다음 단계에 전달**이다. 지금 도는 조작을 끊으면 반쯤 채운 폼이
 * 남는다 — 단계 경계에서 받는 편이 안전하고, 급할 때만 즉시로 끊는다.
 */
export function SteerBox({
  mode,
  onSend,
  onRetry,
  retryPlaceholder,
}: {
  /**
   * 같은 상자가 세 상태를 갖는다.
   *
   * - `live` — 준비·신청이 도는 중. 지시를 큐에 넣는다.
   * - `retry` — 멈춘 뒤. 여기서 받은 글은 지시가 아니라 **모자랐던 입력**이고,
   *   준비를 처음부터 다시 건다. 상자를 죽여 두면 사용자가 할 수 있는 일은
   *   화면을 버리고 처음부터 다시 시작하는 것뿐이다.
   * - `off` — 아직 실행이 없다.
   */
  mode: "live" | "retry" | "off";
  onSend: (text: string, mode: "now" | "next") => void;
  onRetry: (text: string) => void;
  /**
   * 멈춘 이유가 구체적일 때 그 질문을 안내문으로 쓴다.
   *
   * 기본 문구(「공고 내용을 붙여넣거나…」)는 어떤 실패에도 맞는 대신 어떤
   * 실패에도 안 맞는다. 판정이 「검색으로는 특정하지 못했다」고 말했으면
   * 그 말이 입력칸에 있어야 사용자가 무엇을 줄지 안다.
   */
  retryPlaceholder?: string;
}) {
  const [text, setText] = useState("");
  const retry = mode === "retry";
  const disabled = mode === "off";

  const send = (urgency: "now" | "next") => {
    const value = text.trim();
    if (!value) return;
    if (retry) onRetry(value);
    else onSend(value, urgency);
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
          send(!retry && (event.metaKey || event.ctrlKey) ? "now" : "next");
        }}
        placeholder={
          retry
            ? (retryPlaceholder ??
              "공고 내용을 붙여넣거나 링크를 넣으면 이어서 진행합니다")
            : disabled
              ? "준비나 신청이 도는 동안 지시할 수 있습니다"
              : "에이전트에게 지시 — 예: 주소는 본사로 써줘"
        }
        className="h-9"
      />
      <Button
        size="sm"
        variant={retry ? "default" : "outline"}
        disabled={disabled || !text.trim()}
        onClick={() => send("next")}
        title={
          retry ? "보탠 내용으로 준비를 다시 돈다" : "지금 하는 일을 마치고 전달한다"
        }
      >
        {retry ? <RotateCw /> : <CornerDownLeft />}
        {retry ? "이어서 진행" : "전달"}
      </Button>
      {/* 「즉시」는 도는 것을 끊는 버튼이다. 멈춘 뒤에는 끊을 것이 없다. */}
      {!retry && (
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
      )}
    </div>
  );
}
