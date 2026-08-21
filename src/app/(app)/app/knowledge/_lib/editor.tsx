"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { GraphEdge, Memory } from "@/app/(labs)/lab/notice/_lib/memory";

import { KnowledgeGraph } from "./graph";

const KIND_LABEL: Record<Memory["kind"], string> = {
  fact: "사실",
  item: "아이템",
  strength: "강점",
  narrative: "서술",
};

export function KnowledgeEditor({
  memories,
  edges,
}: {
  memories: Memory[];
  edges: GraphEdge[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Memory | null>(null);
  const [draft, setDraft] = useState({ label: "", value: "" });
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      const response = await fetch("/app/knowledge/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      toast.success(done);
      setSelected(null);
      setDraft({ label: "", value: "" });
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <KnowledgeGraph
        memories={memories}
        edges={edges}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <ul className="space-y-2">
          {memories.map((memory) => (
            <li
              key={memory.id}
              className="rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-brand/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{KIND_LABEL[memory.kind]}</Badge>
                <span className="text-sm font-medium">{memory.label}</span>
                {memory.sourceNotice && (
                  <span className="text-xs text-muted-foreground">
                    출처 · {memory.sourceNotice}
                  </span>
                )}
                <span className="ml-auto flex gap-1">
                  <Button variant="ghost" size="xs" onClick={() => setSelected(memory)}>
                    수정
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="삭제"
                    disabled={busy}
                    onClick={() => send({ action: "delete", id: memory.id }, "지웠다")}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{memory.value}</p>
            </li>
          ))}
          {memories.length === 0 && (
            <li className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              공고를 처리하면 입력한 정보가 여기에 쌓인다.
            </li>
          )}
        </ul>

        <aside className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">{selected ? "지식 수정" : "지식 추가"}</h2>
          <Input
            placeholder="항목명 (예: 주력 아이템)"
            value={selected ? selected.label : draft.label}
            onChange={(event) =>
              selected
                ? setSelected({ ...selected, label: event.target.value })
                : setDraft((prev) => ({ ...prev, label: event.target.value }))
            }
          />
          <Textarea
            rows={5}
            placeholder="내용"
            value={selected ? selected.value : draft.value}
            onChange={(event) =>
              selected
                ? setSelected({ ...selected, value: event.target.value })
                : setDraft((prev) => ({ ...prev, value: event.target.value }))
            }
          />
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                selected
                  ? send(
                      {
                        action: "update",
                        id: selected.id,
                        label: selected.label,
                        value: selected.value,
                      },
                      "고쳤다",
                    )
                  : send({ ...draft, kind: "fact" }, "기억했다")
              }
            >
              {busy ? <Loader2 className="animate-spin" /> : <Plus />}
              {selected ? "저장" : "추가"}
            </Button>
            {selected && (
              <Button variant="ghost" onClick={() => setSelected(null)}>
                취소
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            저장하면 임베딩을 다시 만들어 그래프의 연결도 갱신된다.
          </p>
        </aside>
      </div>
    </div>
  );
}
