"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { engine } from "@/content/engine";

import { T } from "./parts";

/**
 * Studio ↔ Solar 왕복.
 *
 * 담당이 바뀌는 지점이 곧 한 엔진의 출력이 다른 엔진의 입력이 되는 지점이라,
 * **선이 줄을 건너는 횟수가 그대로 인계 횟수다.** 그래서 자리만 옮겨 놓지 않고
 * 칸과 칸을 실제로 잇는다 — 위치로만 암시하면 카드 열한 개가 빈 공간에 흩어져
 * 있는 것으로 보이고, 무엇이 무엇 다음인지 세어야 안다.
 *
 * **가로로 눕힌다.** 세로로 세우면 한 스텝이 한 행을 통째로 쓰고 폭의 3분의 2가
 * 빈 채 남아 그림 하나가 2,200px 이 됐다. 눕히면 같은 내용이 세 줄에 들어가고,
 * 남는 것은 가로 스크롤인데 그건 이 상자 안에서만 흐른다.
 *
 * 선은 **재어서 그린다.** 칸 너비는 고정이지만 카드 높이는 글자 수에 따라
 * 바뀌므로, 좌표를 CSS 로 고정하면 어느 줄에선가 반드시 어긋난다.
 */
const LANE_ORDER = ["solar", "studio", "run"] as const;
type LaneId = (typeof LANE_ORDER)[number];

type Link = { d: string; studio: boolean };

export function Handoff() {
  const { steps, lanes } = engine.journey;
  const laneOf = (id: string) => LANE_ORDER.indexOf(id as LaneId);

  const wrap = useRef<HTMLDivElement>(null);
  const cards = useRef<Array<HTMLDivElement | null>>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const measure = () => {
      const frame = wrap.current;
      if (!frame) return;
      const origin = frame.getBoundingClientRect();
      // ⚠ `width` 가 아니라 `scrollWidth` 다. 보이는 폭만 덮으면 오른쪽으로
      //   밀어 둔 카드들 사이의 선이 잘려 나간다.
      const w = frame.scrollWidth;
      const h = frame.scrollHeight;
      if (w === 0) return;

      const next: Link[] = [];
      for (let i = 0; i < steps.length - 1; i += 1) {
        const from = cards.current[i]?.getBoundingClientRect();
        const to = cards.current[i + 1]?.getBoundingClientRect();
        if (!from || !to) continue;
        // 스크롤된 만큼을 더해 컨테이너 좌표로 옮긴다.
        const x1 = from.right - origin.left + frame.scrollLeft;
        const y1 = from.top + from.height / 2 - origin.top + frame.scrollTop;
        const x2 = to.left - origin.left + frame.scrollLeft;
        const y2 = to.top + to.height / 2 - origin.top + frame.scrollTop;
        const bend = Math.max(16, (x2 - x1) * 0.55);
        next.push({
          d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
          // **Studio 를 건드리는 선만** 칠한다. 이 격자에서는 연속한 두 칸이
          // 거의 언제나 다른 줄이라, 「줄을 건넜는가」로 칠하면 열 개가 전부
          // 켜져 정작 두 엔진의 인계가 안 보인다.
          studio: steps[i].lane === "studio" || steps[i + 1].lane === "studio",
        });
      }
      setBox({ w, h });
      setLinks(next);
    };

    measure();
    // 카드 높이는 글꼴이 늦게 오면 한 번 더 바뀐다. 관측자가 그걸 받아 준다.
    const observer = new ResizeObserver(measure);
    if (wrap.current) observer.observe(wrap.current);
    for (const node of cards.current) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [steps]);

  const handoffs = links.filter((link) => link.studio).length;

  return (
    <div>
      <div className="rounded-2xl border border-border bg-card/20 p-3">
        <div
          ref={wrap}
          className="relative overflow-x-auto pb-1"
          style={{
            // 첫 칸은 줄 이름, 나머지는 스텝. 스텝 칸 너비를 고정해야 카드가
            // 글자 수에 따라 들쭉날쭉해지지 않는다.
            display: "grid",
            gridTemplateColumns: "5.5rem",
            gridTemplateRows: "repeat(3, auto)",
            gridAutoColumns: "15rem",
            gridAutoFlow: "column",
            columnGap: "0.75rem",
            rowGap: "1.25rem",
            // 카드가 줄 높이를 채우도록 늘어나면 빈 줄이 지나가는 구간마다
            // 커다란 여백이 생긴다. 글자 높이만큼만 쓰게 한다.
            alignItems: "start",
          }}
        >
          {box.w > 0 && (
            <svg
              className="pointer-events-none absolute top-0 left-0"
              width={box.w}
              height={box.h}
              viewBox={`0 0 ${box.w} ${box.h}`}
              aria-hidden
            >
              <defs>
                <marker
                  id="handoff-tip"
                  viewBox="0 0 8 8"
                  refX="6"
                  refY="4"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path d="M 0 1 L 7 4 L 0 7 z" className="fill-brand/70" />
                </marker>
                <marker
                  id="handoff-tip-quiet"
                  viewBox="0 0 8 8"
                  refX="6"
                  refY="4"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path d="M 0 1 L 7 4 L 0 7 z" className="fill-border" />
                </marker>
              </defs>
              {links.map((link, index) => (
                <path
                  key={index}
                  d={link.d}
                  fill="none"
                  strokeWidth={link.studio ? 1.75 : 1.25}
                  className={link.studio ? "stroke-brand/70" : "stroke-border"}
                  markerEnd={`url(#handoff-tip${link.studio ? "" : "-quiet"})`}
                />
              ))}
            </svg>
          )}

          {/* 줄 이름은 가로로 밀어도 제자리에 남는다. 안 그러면 세 번째 칸부터
              어느 줄이 누구 것인지 알 수 없다 */}
          {LANE_ORDER.map((id, row) => (
            <div
              key={id}
              // `alignSelf: stretch` 가 없으면 이 칸이 알약 높이만큼만 차지해,
              // 가로로 밀린 카드가 그 위아래로 삐져나와 글자가 겹친다.
              style={{ gridColumn: 1, gridRow: row + 1, alignSelf: "stretch" }}
              className="sticky left-0 z-20 flex items-center border-r border-border/60 bg-background pr-2"
            >
              <p
                className={cn(
                  "w-full rounded-lg border px-2 py-2 text-center font-mono text-[10px] leading-tight",
                  id === "studio"
                    ? "border-brand/40 bg-brand/8 text-brand"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                {lanes[id]}
              </p>
            </div>
          ))}

          {steps.map((step, index) => (
            <div
              key={step.title}
              ref={(node) => {
                cards.current[index] = node;
              }}
              // 한 스텝 = 한 칸. 줄은 담당이 정한다.
              style={{ gridColumn: index + 2, gridRow: laneOf(step.lane) + 1 }}
              className={cn(
                "relative z-10 rounded-xl border p-3",
                step.lane === "studio"
                  ? "border-brand/35 bg-brand/5"
                  : "border-border bg-card/60",
              )}
            >
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                <span
                  className={cn(
                    "font-mono text-[10px] tabular-nums",
                    step.lane === "studio" ? "text-brand/70" : "text-muted-foreground/60",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    step.lane === "studio" ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  {step.actor}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-snug font-medium">{step.title}</p>
              {"badge" in step && step.badge && (
                <span className="mt-1.5 inline-block rounded border border-brand/40 bg-brand/10 px-1.5 py-0.5 font-mono text-[9px] text-brand">
                  {step.badge}
                </span>
              )}
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <T>{step.body}</T>
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        줄이 바뀔 때마다 담당이 바뀐다. 굵은 선 {handoffs}개가 Studio 와 Solar 가 서로에게
        결과를 넘기는 지점이다 · 가로로 넘겨 본다 →
      </p>
    </div>
  );
}
