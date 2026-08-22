"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";

type Scope = "sessions" | "knowledge";

/**
 * 되돌릴 수 없는 것들. **여기 말고 다른 데 두지 않는다.**
 *
 * 목록 한복판에 「전부 삭제」가 있으면 개별 삭제를 누르러 온 손이 그것을 스친다.
 * 설정 맨 아래는 일부러 찾아와야 하는 자리다.
 *
 * 그래서 한 겹 더 둔다 — **이름을 그대로 쳐야** 버튼이 열린다. 「정말요?」
 * 한 번은 습관적으로 눌러진다. 지식베이스는 다시 만들 원본이 없어서, 그
 * 한 번이 이 제품이 파는 것을 통째로 지운다.
 */
const PLAN: Record<
  Scope,
  { title: string; body: string; confirm: string; done: (json: Reset) => string }
> = {
  sessions: {
    title: "모든 세션 삭제",
    body: "지금까지 시작한 세션이 전부 사라집니다 — 요약·계획·입력 항목·신청 결과까지. 지식베이스에 남긴 값은 그대로 있습니다.",
    confirm: "세션 삭제",
    done: (json) => `세션 ${json.goals ?? 0}개를 지웠습니다.`,
  },
  knowledge: {
    title: "지식베이스 초기화",
    body: "기억한 값과 보관해 둔 서류가 전부 사라집니다. 다음 공고부터는 이미 답한 것을 처음부터 다시 묻습니다.",
    confirm: "지식베이스 초기화",
    done: (json) =>
      `기억 ${json.memories ?? 0}개, 서류 ${json.documents ?? 0}건을 지웠습니다.`,
  },
};

type Reset = { goals?: number; memories?: number; documents?: number; error?: string };

export function DangerZone({
  counts,
}: {
  /** 무엇이 몇 개 지워지는지 **미리** 보여준다. 「전부」는 숫자가 아니다 */
  counts: { goals: number; memories: number; documents: number };
}) {
  const [open, setOpen] = useState<Scope | null>(null);

  return (
    <section className="mt-12 space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-destructive">
          되돌릴 수 없는 작업
        </h2>
        <p className="text-sm text-muted-foreground">
          지운 것은 복구할 방법이 없습니다. 확인 문구를 그대로 입력해야 실행됩니다.
        </p>
      </header>

      <div className="divide-y divide-border rounded-xl border border-destructive/30">
        <Row
          title={PLAN.sessions.title}
          detail={`세션 ${counts.goals}개`}
          onClick={() => setOpen("sessions")}
          disabled={counts.goals === 0}
        />
        <Row
          title={PLAN.knowledge.title}
          detail={`기억 ${counts.memories}개 · 보관 서류 ${counts.documents}건`}
          onClick={() => setOpen("knowledge")}
          disabled={counts.memories === 0 && counts.documents === 0}
        />
      </div>

      {open && <ConfirmDialog scope={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function Row({
  title,
  detail,
  onClick,
  disabled,
}: {
  title: string;
  detail: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {/* 지울 것이 없으면 그렇다고 쓴다. 비활성 버튼만 있으면 왜 안 눌리는지
              사용자가 알 방법이 없다. */}
          {disabled ? "지울 것이 없습니다" : detail}
        </p>
      </div>
      <Button variant="destructive" size="sm" disabled={disabled} onClick={onClick}>
        지우기
      </Button>
    </div>
  );
}

function ConfirmDialog({ scope, onClose }: { scope: Scope; onClose: () => void }) {
  const router = useRouter();
  const plan = PLAN[scope];
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const response = await fetch("/app/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const json = (await response.json().catch(() => null)) as Reset | null;
      if (!response.ok || !json) {
        throw new Error(json?.error ?? `HTTP ${response.status}`);
      }
      onClose();
      // 몇 개가 지워졌는지 말한다. 「완료」만 띄우면 정말 지워졌는지 알 수 없다.
      toast.success(plan.done(json));
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan.title}</DialogTitle>
          <DialogDescription>{plan.body}</DialogDescription>
        </DialogHeader>
        <label className="space-y-1.5">
          <span className="text-xs text-muted-foreground">
            확인을 위해 <span className="text-foreground">{plan.confirm}</span> 을(를)
            그대로 입력하세요.
          </span>
          <Input
            value={typed}
            autoFocus
            onChange={(event) => setTyped(event.target.value)}
            placeholder={plan.confirm}
          />
        </label>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={busy} />}>
            그만두기
          </DialogClose>
          <Button
            variant="destructive"
            disabled={busy || typed.trim() !== plan.confirm}
            onClick={() => void run()}
          >
            {busy && <Loader2 className="animate-spin" />}
            지우기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
