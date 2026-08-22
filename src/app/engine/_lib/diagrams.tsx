import { cn } from "@/lib/utils";
import { engine } from "@/content/engine";

import { T } from "./parts";

/**
 * 그림들.
 *
 * 표로 충분한 것은 표로 두고, **구조가 곧 요점인 것**만 그린다 — 게이트웨이의
 * 복구 루프, 레인의 슬롯 수, 컨텍스트 창이 무엇을 버리는가, 벡터가 왜 두 벌인가.
 * 라벨은 전부 `src/content/engine.ts` 에서 온다.
 */

// ── 준비 파이프라인 레일 ────────────────────────────────────────────────
export function PipelineRail() {
  const { stages, apply } = engine.flow;
  return (
    <ol className="relative space-y-3 before:absolute before:top-4 before:bottom-4 before:left-[15px] before:w-px before:bg-border">
      {stages.map((stage, index) => (
        <li key={stage.id} className="relative flex gap-4">
          <span className="relative z-10 mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-[11px] text-muted-foreground">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-xs text-brand">{stage.id}</span>
              <span className="text-sm font-medium">{stage.title}</span>
              <span className="text-[11px] text-muted-foreground">
                화면 카드 · {stage.card}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              <T>{stage.body}</T>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip tone="brand">{stage.engine}</Chip>
              <Chip>tier {stage.tier}</Chip>
              <Chip>lane {stage.lane}</Chip>
              <Chip>{stage.guard}</Chip>
            </div>
          </div>
        </li>
      ))}
      <li className="relative flex gap-4">
        <span className="relative z-10 mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-brand/50 bg-brand/10 font-mono text-[11px] text-brand">
          ▶
        </span>
        <div className="min-w-0 flex-1 rounded-2xl border border-brand/30 bg-brand/5 p-4">
          <p className="text-sm font-medium">{apply.title}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            <T>{apply.body}</T>
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip tone="brand">{apply.engine}</Chip>
            <Chip>lane {apply.lane}</Chip>
          </div>
        </div>
      </li>
    </ol>
  );
}

function Chip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "brand";
}) {
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 font-mono text-[10px] whitespace-nowrap",
        tone === "brand"
          ? "border-brand/30 bg-brand/8 text-brand"
          : "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

// ── 게이트웨이 복구 루프 ────────────────────────────────────────────────
const GATE = [
  { x: 8, label: "zod schema", note: ".nullish()" },
  { x: 148, label: "contractOf", note: "「json」 강제" },
  { x: 288, label: "generateObject", note: "tier · lane" },
  { x: 438, label: "runRules", note: "의미 검증" },
  { x: 578, label: "normalize", note: "확정 모양" },
] as const;

export function GatewayLoop() {
  const W = 704;
  const H = 146;
  const w = 118;
  const h = 46;
  const y = 20;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card/40 p-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label="게이트웨이 — 계약 · 검증 · 복구 흐름"
        className="max-w-none"
      >
        <defs>
          <marker
            id="gate-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1 L 7 4 L 0 7 z" className="fill-border" />
          </marker>
          <marker
            id="gate-arrow-brand"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1 L 7 4 L 0 7 z" className="fill-brand/70" />
          </marker>
        </defs>

        {GATE.slice(0, -1).map((node, index) => (
          <line
            key={node.label}
            x1={node.x + w}
            y1={y + h / 2}
            x2={GATE[index + 1].x - 7}
            y2={y + h / 2}
            strokeWidth="1.5"
            markerEnd="url(#gate-arrow)"
            className="stroke-border"
          />
        ))}

        {/* 복구는 한 번뿐이다. 되돌아가는 화살표가 하나인 것이 그 사실이다 */}
        <path
          d={`M ${GATE[3].x + w / 2} ${y + h} C ${GATE[3].x + w / 2} ${y + h + 30}, ${GATE[2].x + w / 2} ${y + h + 30}, ${GATE[2].x + w / 2} ${y + h + 7}`}
          fill="none"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          markerEnd="url(#gate-arrow-brand)"
          className="stroke-brand/70"
        />
        <text
          x={(GATE[2].x + GATE[3].x + w) / 2}
          y={y + h + 48}
          textAnchor="middle"
          className="fill-brand font-mono text-[10px]"
        >
          reject → 한 번만 되묻는다
        </text>

        {GATE.map((node) => (
          <g key={node.label}>
            <rect
              x={node.x}
              y={y}
              width={w}
              height={h}
              rx="8"
              strokeWidth="1"
              className="fill-background stroke-border"
            />
            <text
              x={node.x + w / 2}
              y={y + 20}
              textAnchor="middle"
              className="fill-foreground font-mono text-[11px]"
            >
              {node.label}
            </text>
            <text
              x={node.x + w / 2}
              y={y + 34}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[9px]"
            >
              {node.note}
            </text>
          </g>
        ))}

        <text x={GATE[3].x} y={12} className="fill-muted-foreground font-mono text-[9px]">
          drop → 그 값만 버린다
        </text>
      </svg>
    </div>
  );
}

// ── 레인 게이지 ─────────────────────────────────────────────────────────
export function LaneBars() {
  const { lanes, desktop } = engine.runtime;
  return (
    <div className="space-y-2">
      {lanes.map((lane) => (
        <div
          key={lane.name}
          className="rounded-xl border border-border bg-card/40 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 font-mono text-xs text-brand">
              {lane.name}
            </span>
            <span className="flex gap-1" aria-label={`동시 실행 상한 ${lane.limit}`}>
              {Array.from({ length: lane.limit }).map((_, index) => (
                <span
                  key={index}
                  className="size-3 rounded-[3px] border border-brand/40 bg-brand/20"
                />
              ))}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              상한 {lane.limit}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            <T>{lane.body}</T>
          </p>
        </div>
      ))}
      <div className="rounded-xl border border-dashed border-border bg-transparent px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
            {desktop.name}
          </span>
          <span className="flex gap-1">
            {Array.from({ length: desktop.limit }).map((_, index) => (
              <span
                key={index}
                className="size-3 rounded-[3px] border border-border bg-muted"
              />
            ))}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            레인 밖 · 즉시 거절
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          <T>{desktop.body}</T>
        </p>
      </div>
    </div>
  );
}

// ── 컨텍스트 창 ─────────────────────────────────────────────────────────
export function WindowStrip() {
  const total = 16;
  const keep = 2;
  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <p className="font-mono text-[11px] text-muted-foreground">
        도구 결과 누적 (스냅샷 1장 ≈ 5~6KB · 스텝 상한 40)
      </p>
      <div className="mt-3 flex flex-wrap gap-1">
        {Array.from({ length: total }).map((_, index) => {
          const kept = index >= total - keep;
          return (
            <span
              key={index}
              className={cn(
                "h-9 flex-1 basis-10 rounded-[4px] border",
                kept
                  ? "border-brand/50 bg-brand/15"
                  : "border-border bg-[repeating-linear-gradient(135deg,transparent,transparent_3px,var(--color-border)_3px,var(--color-border)_4px)]",
              )}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[10px]">
        <span className="text-brand">■ 최근 2장 — 원문 그대로</span>
        <span className="text-muted-foreground">▨ 나머지 — 스텁으로 치환</span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        <T>{engine.browser.window.key}</T>
      </p>
    </div>
  );
}

// ── 벡터 두 벌 ──────────────────────────────────────────────────────────
export function DualVector() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {engine.memory.dual.columns.map((column, index) => (
        <div key={column.name} className="rounded-xl border border-border bg-card/40 p-4">
          <p className="font-mono text-xs text-brand">{column.name}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            <T>{column.body}</T>
          </p>
          <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2 font-mono text-[10px] text-muted-foreground">
            {index === 0 ? 'embed("현재 직원 수")' : 'embed("현재 직원 수: 137")'}
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            {index === 0
              ? "→ 다음 공고의 「상시근로자 수」와 이어 붙는다"
              : "→ 「우리 회사 규모가 어떻게 되지?」에 답한다"}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Studio 실행 3단계 ──────────────────────────────────────────────────
export function StudioSequence() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
      {engine.studio.run.steps.map((step, index) => (
        <li key={step.call} className="bg-background p-4">
          <p className="font-mono text-[10px] text-muted-foreground">{index + 1}</p>
          <p className="mt-1 font-mono text-xs break-all text-brand">{step.call}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            <T>{step.body}</T>
          </p>
        </li>
      ))}
    </ol>
  );
}

// ── 두 엔진의 분업 ─────────────────────────────────────────────────────
export function Duo() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {engine.duo.columns.map((column, index) => (
        <div
          key={column.name}
          className={cn(
            "rounded-2xl border p-5",
            index === 0 ? "border-brand/35 bg-brand/5" : "border-border bg-card/40",
          )}
        >
          <p
            className={cn(
              "font-mono text-xs",
              index === 0 ? "text-brand" : "text-muted-foreground",
            )}
          >
            {column.role}
          </p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight">{column.name}</h3>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            <T>{column.body}</T>
          </p>
          <ul className="mt-4 space-y-2 border-t border-border/60 pt-4">
            {column.does.map((line) => (
              <li
                key={line}
                className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground"
              >
                <span
                  className={cn(
                    "mt-1.5 size-1 shrink-0 rounded-full",
                    index === 0 ? "bg-brand" : "bg-border",
                  )}
                />
                <T>{line}</T>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
