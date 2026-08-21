"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { GraphEdge, Memory } from "@/app/(labs)/lab/notice/_lib/memory";

/**
 * 지식 그래프.
 *
 * 간선은 꾸며낸 것이 아니라 저장된 임베딩의 실제 코사인 유사도다. 굵기가 곧
 * 유사도이고, 지식이 늘수록 그물이 촘촘해진다.
 *
 * 힘 기반 배치를 직접 돌린다 — d3 를 넣을 만큼 복잡하지 않고, 노드 수가
 * 수십 개라 이 정도로 충분하다.
 */
const KIND_COLOR: Record<Memory["kind"], string> = {
  fact: "var(--muted-foreground)",
  item: "var(--brand)",
  strength: "oklch(0.72 0.17 150)",
  narrative: "oklch(0.75 0.15 65)",
};

const KIND_LABEL: Record<Memory["kind"], string> = {
  fact: "사실",
  item: "아이템",
  strength: "강점",
  narrative: "서술",
};

type Node = { id: string; x: number; y: number; vx: number; vy: number; memory: Memory };

export function KnowledgeGraph({
  memories,
  edges,
  onSelect,
  selectedId,
}: {
  memories: Memory[];
  edges: GraphEdge[];
  onSelect?: (memory: Memory) => void;
  selectedId?: string | null;
}) {
  const width = 900;
  const height = 340;

  /**
   * 좌표를 state 로 들고 있는다. ref 로 두면 렌더 중 접근이 되어
   * react-hooks 규칙(Cannot access refs during render)에 걸린다.
   */
  const [positions, setPositions] = useState<Map<string, Node>>(new Map());

  /**
   * 배치는 렌더 중에 유도한다. 이펙트에서 setState 로 초기화하면
   * 연쇄 렌더가 되고 react-hooks 규칙에도 걸린다.
   * 이미 계산된 좌표가 있으면 그대로 쓰고, 새 노드만 원형으로 끼워 넣는다.
   */
  const layout: Node[] = memories.map((memory, index) => {
    const found = positions.get(memory.id);
    if (found) return { ...found, memory };
    const angle = (index / Math.max(memories.length, 1)) * Math.PI * 2;
    return {
      id: memory.id,
      x: width / 2 + Math.cos(angle) * 90,
      y: height / 2 + Math.sin(angle) * 90,
      vx: 0,
      vy: 0,
      memory,
    };
  });

  useEffect(() => {
    if (memories.length === 0) return;
    let ticks = 0;
    let frame = 0;

    const step = () => {
      setPositions((current) => {
        const seeded: Node[] = memories.map((memory, index) => {
          const found = current.get(memory.id);
          if (found) return { ...found, memory };
          const angle = (index / Math.max(memories.length, 1)) * Math.PI * 2;
          return {
            id: memory.id,
            x: width / 2 + Math.cos(angle) * 90,
            y: height / 2 + Math.sin(angle) * 90,
            vx: 0,
            vy: 0,
            memory,
          };
        });
        const next = seeded.map((node) => ({ ...node }));
        const byId = new Map(next.map((node) => [node.id, node]));

        for (const node of next) {
          // 중심으로 약하게 당긴다
          node.vx += (width / 2 - node.x) * 0.0016;
          node.vy += (height / 2 - node.y) * 0.0016;

          // 서로 밀어낸다
          for (const other of next) {
            if (other === node) continue;
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const distance = Math.hypot(dx, dy) || 1;
            const push = 900 / (distance * distance);
            node.vx += (dx / distance) * push;
            node.vy += (dy / distance) * push;
          }
        }

        // 유사한 것끼리 당긴다 — 유사도가 곧 스프링 강성이다
        for (const edge of edges) {
          const a = byId.get(edge.source);
          const b = byId.get(edge.target);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 1;
          const target = 130 - edge.weight * 60;
          const pull = (distance - target) * 0.004 * edge.weight;
          a.vx += (dx / distance) * pull;
          a.vy += (dy / distance) * pull;
          b.vx -= (dx / distance) * pull;
          b.vy -= (dy / distance) * pull;
        }

        for (const node of next) {
          node.vx *= 0.86;
          node.vy *= 0.86;
          node.x = Math.max(24, Math.min(width - 24, node.x + node.vx));
          node.y = Math.max(24, Math.min(height - 24, node.y + node.vy));
        }
        return new Map(next.map((node) => [node.id, node]));
      });

      ticks += 1;
      // 안정되면 멈춘다. 계속 돌리면 배터리만 먹는다.
      if (ticks < 240) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [memories, edges]);

  if (memories.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
        아직 쌓인 지식이 없다. 공고를 하나 처리하면 여기서부터 자란다.
      </div>
    );
  }

  const byId = new Map(layout.map((node) => [node.id, node]));

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5 text-xs">
        <span className="font-medium">지식 그래프</span>
        <span className="text-muted-foreground">
          노드 {memories.length} · 연결 {edges.length}
        </span>
        <span className="ml-auto flex items-center gap-3">
          {(Object.keys(KIND_LABEL) as Memory["kind"][]).map((kind) => (
            <span key={kind} className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ background: KIND_COLOR[kind] }}
              />
              {KIND_LABEL[kind]}
            </span>
          ))}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-[340px] w-full">
        <g>
          {edges.map((edge) => {
            const a = byId.get(edge.source);
            const b = byId.get(edge.target);
            if (!a || !b) return null;
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--brand)"
                strokeOpacity={Math.max(0.08, (edge.weight - 0.4) * 0.9)}
                strokeWidth={Math.max(0.5, (edge.weight - 0.4) * 6)}
              />
            );
          })}
        </g>
        <g>
          {layout.map((node) => {
            const selected = selectedId === node.id;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x} ${node.y})`}
                className="cursor-pointer"
                onClick={() => onSelect?.(node.memory)}
              >
                <circle
                  r={selected ? 9 : 6}
                  fill={KIND_COLOR[node.memory.kind]}
                  fillOpacity={selected ? 1 : 0.85}
                  stroke="var(--background)"
                  strokeWidth={2}
                />
                <text
                  y={-13}
                  textAnchor="middle"
                  className={cn(
                    "fill-foreground text-[10px]",
                    !selected && "fill-muted-foreground",
                  )}
                >
                  {node.memory.label.slice(0, 12)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
