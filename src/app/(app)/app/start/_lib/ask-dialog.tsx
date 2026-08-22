"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/**
 * 에이전트가 도중에 묻는 것.
 *
 * 스크롤해야 보이는 자리에 두면 사용자는 무언가를 기다린다는 사실조차 모른다 —
 * 그동안 에이전트는 멈춰 있다. 화면 가운데로 올린다.
 *
 * 뒤가 완전히 가려지지 않게 둔다. 답하는 동안에도 다른 에이전트는 돌고 있고,
 * 그게 보여야 「멈춘 것이 아니라 나를 기다리는 것」이 읽힌다.
 */
export type AskItem = { id: string; label: string; why: string };

export function AskDialog({
  item,
  onAnswer,
}: {
  item: AskItem | null;
  onAnswer: (id: string, value: string | null) => void;
}) {
  // 질문마다 새 상태로 시작한다. effect 로 비우면 한 프레임 동안 앞의 답이
  // 보이고, 그 사이 사용자가 누르면 엉뚱한 값이 간다 — key 로 갈아 끼운다.
  return <AskBody key={item?.id ?? "none"} item={item} onAnswer={onAnswer} />;
}

function AskBody({
  item,
  onAnswer,
}: {
  item: AskItem | null;
  onAnswer: (id: string, value: string | null) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <Dialog
      open={Boolean(item)}
      onOpenChange={(open) => {
        if (!open && item) onAnswer(item.id, null);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="size-4 text-brand" />
            {item?.label}
          </DialogTitle>
          {item?.why && <DialogDescription>{item.why}</DialogDescription>}
        </DialogHeader>

        <Textarea
          autoFocus
          rows={4}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="값을 입력하세요"
          onKeyDown={(event) => {
            // 여러 줄을 받는 칸이라 Enter 는 줄바꿈이다. 제출은 ⌘/Ctrl+Enter.
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && item) {
              event.preventDefault();
              if (value.trim()) onAnswer(item.id, value.trim());
            }
          }}
        />

        <div className="flex items-center gap-2">
          <Button
            disabled={!value.trim()}
            onClick={() => item && onAnswer(item.id, value.trim())}
          >
            보내기
          </Button>
          <Button
            variant="ghost"
            onClick={() => item && onAnswer(item.id, null)}
            title="이 항목을 비워 두고 진행한다"
          >
            모르겠다
          </Button>
          <span className="ml-auto font-mono text-xs text-muted-foreground">⌘↵</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
