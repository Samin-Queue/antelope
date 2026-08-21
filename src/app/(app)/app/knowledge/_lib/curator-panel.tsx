"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Applied = { op: string; target: string | null; label: string | null };

const OP_LABEL: Record<string, string> = {
  add: "추가",
  update: "수정",
  delete: "삭제",
};

/**
 * 지식은 말로만 고친다.
 *
 * 입력칸을 직접 열어주지 않는 이유는, 이 컨텍스트를 관리하는 주체가
 * 에이전트라는 사실이 화면에서 그대로 드러나야 하기 때문이다.
 */
export function CuratorPanel() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [applied, setApplied] = useState<Applied[]>([]);

  async function send() {
    const instruction = text.trim();
    if (!instruction || busy) return;
    setBusy(true);
    setReply(null);
    setApplied([]);
    try {
      const response = await fetch("/app/knowledge/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      setReply(json.reply as string);
      setApplied((json.applied ?? []) as Applied[]);
      setText("");
      router.refresh();
    } catch (cause) {
      setReply(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-brand" />
        <h2 className="text-sm font-medium">지식 관리</h2>
        <span className="text-xs text-muted-foreground">
          직접 고치지 않는다. 무엇을 바꿀지 말하면 에이전트가 반영한다.
        </span>
      </div>

      <div className="mt-3 flex items-end gap-2 rounded-xl border border-border bg-background p-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="예: 직원 5명으로 늘었어 / 작년 매출은 1억 2천이야 / 수출 실적 항목은 지워줘"
          className="w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button
          size="icon-sm"
          className="rounded-full"
          aria-label="보내기"
          disabled={busy || !text.trim()}
          onClick={send}
        >
          {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
        </Button>
      </div>

      {reply && (
        <div className="mt-3 space-y-2">
          {applied.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {applied.map((action, index) => (
                <Badge key={`${action.op}-${index}`} variant="secondary">
                  {OP_LABEL[action.op] ?? action.op} · {action.target ?? action.label}
                </Badge>
              ))}
            </div>
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">{reply}</p>
        </div>
      )}
    </section>
  );
}
