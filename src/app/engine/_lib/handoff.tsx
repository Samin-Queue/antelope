"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { engine } from "@/content/engine";

import { T } from "./parts";

/**
 * Studio ↔ Solar 왕복.
 *
 * 담당이 바뀌는 지점이 곧 한 엔진의 출력이 다른 엔진의 입력이 되는 지점이라,
 * **선이 칸을 건너는 횟수가 그대로 인계 횟수다.** 그래서 자리만 옮겨 놓지 않고
 * 칸과 칸을 실제로 잇는다 — 위치로만 암시하면 카드 열두 개가 빈 공간에 흩어져
 * 있는 것으로 보이고, 무엇이 무엇 다음인지 세어야 안다.
 *
 * 선은 **재어서 그린다.** 열 너비가 화면 폭에 따라 바뀌고 카드 높이는 글자 수에
 * 따라 바뀌므로, 좌표를 CSS 로 고정하면 어느 폭에선가 반드시 어긋난다.
 */
const LANE_ORDER = ["solar", "studio", "run"] as const;
type LaneId = (typeof LANE_ORDER)[number];

/** Tailwind 는 문자열을 조립해 만든 클래스를 못 찾는다. 리터럴로 둔다 */
const COL_START = ["sm:col-start-1", "sm:col-start-2", "sm:col-start-3"] as const;

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
      const frame = wrap.current?.getBoundingClientRect();
      if (!frame || frame.width === 0) return;
      const next: Link[] = [];
      for (let i = 0; i < steps.length - 1; i += 1) {
        const from = cards.current[i]?.getBoundingClientRect();
        const to = cards.current[i + 1]?.getBoundingClientRect();
        if (!from || !to) continue;
        const x1 = from.left + from.width / 2 - frame.left;
        const y1 = from.bottom - frame.top;
        const x2 = to.left + to.width / 2 - frame.left;
        const y2 = to.top - frame.top;
        // 세로 간격이 좁아도 곡선이 서게 한다. 직선으로 두면 칸을 건널 때
        // 대각선이 되어 어느 카드에서 나왔는지가 흐려진다.
        const bend = Math.max(14, (y2 - y1) * 0.5);
        next.push({
          d: `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`,
          // **Studio 를 건드리는 선만** 표시한다. 이 격자에서는 연속한 두 칸이
          // 거의 언제나 다른 레인이라, 「칸을 건넜는가」로 칠하면 열 개가 전부
          // 켜져 정작 두 엔진의 인계가 안 보인다.
          studio: steps[i].lane === "studio" || steps[i + 1].lane === "studio",
        });
      }
      setBox({ w: frame.width, h: frame.height });
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
      <div className="mb-3 hidden grid-cols-3 gap-2 sm:grid">
        {LANE_ORDER.map((id) => (
          <p
            key={id}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-center font-mono text-[11px]",
              id === "studio"
                ? "border-brand/40 bg-brand/8 text-brand"
                : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            {lanes[id]}
          </p>
        ))}
      </div>

      <div
        ref={wrap}
        // 세로 간격이 좁으면 곡선이 설 자리가 없어 카드 아래 모서리에 붙어
        // 흐른다. 어느 카드에서 나온 선인지가 그때 흐려진다.
        className="relative grid gap-6 sm:grid-cols-3 sm:gap-x-2 sm:gap-y-9"
      >
        {/* 선은 카드 **뒤에** 깔린다. 위에 그으면 글자를 가로지른다 */}
        {box.w > 0 && (
          <svg
            className="pointer-events-none absolute inset-0"
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
                <path d="M 0 1 L 7 4 L 0 7 z" className="fill-brand/60" />
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

        {steps.map((step, index) => (
          <div
            key={step.title}
            ref={(node) => {
              cards.current[index] = node;
            }}
            // 한 스텝 = 한 행. 명시하지 않으면 격자가 빈 칸을 메우려 들어
            // 4번이 2번 옆에 붙고 순서가 사라진다.
            style={{ gridRow: index + 1 }}
            className={cn(
              "relative rounded-xl border p-3.5",
              COL_START[laneOf(step.lane)],
              step.lane === "studio"
                ? "border-brand/35 bg-brand/5"
                : "border-border bg-card/40",
            )}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
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
              {"badge" in step && step.badge && (
                <span className="rounded border border-brand/40 bg-brand/10 px-1.5 py-0.5 font-mono text-[9px] text-brand">
                  {step.badge}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium">{step.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              <T>{step.body}</T>
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        칸이 옮겨 갈 때마다 담당이 바뀐다. 굵은 선 {handoffs}개가 Studio 와 Solar 가
        서로에게 결과를 넘기는 지점이다.
      </p>
    </div>
  );
}
