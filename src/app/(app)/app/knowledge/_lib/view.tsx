import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GraphEdge, Memory } from "@/app/(labs)/lab/notice/_lib/memory";

import { CuratorPanel } from "./curator-panel";
import { KnowledgeGraph } from "./graph";

const KIND_LABEL: Record<Memory["kind"], string> = {
  fact: "사실",
  item: "아이템",
  strength: "강점",
  narrative: "서술",
};

/**
 * 지식은 하나의 큰 컨텍스트로 보여준다.
 *
 * 항목마다 수정 버튼을 달지 않는다 — 이 컨텍스트를 관리하는 주체는
 * 에이전트이고, 사용자는 말로 지시한다.
 */
export function KnowledgeView({
  memories,
  edges,
  signedIn,
}: {
  memories: Memory[];
  edges: GraphEdge[];
  signedIn: boolean;
}) {
  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          지식은 계정에 쌓인다. 로그인하면 여기서 볼 수 있다.
        </p>
        <Button render={<Link href="/sign-in" />} className="mt-4">
          로그인
        </Button>
      </div>
    );
  }

  const grouped = (["fact", "item", "strength", "narrative"] as const)
    .map((kind) => ({ kind, items: memories.filter((item) => item.kind === kind) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <KnowledgeGraph memories={memories} edges={edges} />
      <CuratorPanel />

      {grouped.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          목표를 하나 처리하면 여기서부터 자란다.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.kind}>
              <h3 className="text-xs font-medium text-muted-foreground">
                {KIND_LABEL[group.kind]} {group.items.length}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {group.items.map((memory) => (
                  <li
                    key={memory.id}
                    className="rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium">{memory.label}</span>
                      {memory.sourceNotice && (
                        <Badge variant="outline" className="text-[10px]">
                          {memory.sourceNotice}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {memory.value}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
