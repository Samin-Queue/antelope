"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * 세션 하나를 지운다 — **한 번 되묻고** 지운다.
 *
 * 준비에 몇 분이 들어간 것이고 스냅샷·계획·입력 항목이 통째로 사라진다.
 * 목록에서 실수로 스치는 자리라 확인 없이 지우면 안 된다.
 *
 * 지운 뒤 `router.refresh()` 로 서버 컴포넌트를 다시 그린다. 목록에서 이 줄만
 * 손으로 빼면 사이드바의 「모든 세션」은 그대로 남아, 지운 세션이 한쪽에만
 * 사라진 상태가 된다.
 */
export function DeleteGoalButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(`/app/sessions/${encodeURIComponent(id)}/delete`, {
        method: "POST",
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(json?.error ?? `HTTP ${response.status}`);
      setOpen(false);
      toast.success("세션을 지웠습니다.");
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`${title} 삭제`}
        title="이 세션 삭제"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 세션을 지울까요?</DialogTitle>
            <DialogDescription>
              「{title}」의 요약·계획·입력 항목이 함께 사라집니다. 되돌릴 수 없습니다.
              {/* 지식베이스는 안 지운다고 **먼저** 말한다. 세션을 지우면 그동안
                  입력한 값까지 날아간다고 오해하면 아무도 못 지운다. */}
              <br />
              지식베이스에 남긴 값은 그대로 있습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={busy} />}>
              그대로 두기
            </DialogClose>
            <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
              {busy && <Loader2 className="animate-spin" />}
              지우기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
