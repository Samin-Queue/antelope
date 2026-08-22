import type { Step } from "@/lib/upstage-studio";

/**
 * Studio Config 를 **실제 워크플로 정의에서 그려낸다.**
 *
 * 그림을 손으로 그려 두면 워크플로를 고친 날 그림만 옛말을 한다 — 검증하러
 * 온 사람에게 그건 틀린 문서보다 나쁘다. `noticeWorkflow()` 같은 순수 함수를
 * 그대로 받아 레이어링하므로, 스텝을 하나 더하면 이 그림이 따라 바뀐다.
 *
 * 레이어는 **가장 긴 경로**로 정한다. 최단 경로로 재면 분기 뒤에서 합류하는
 * 스텝(`gaps`·`brief`)이 분기와 같은 열에 서서 화살표가 뒤로 흐른다.
 */
const NODE_W = 196;
const NODE_H = 54;
const GAP_X = 62;
const GAP_Y = 12;

const TYPE_LABEL: Record<Step["type"], string> = {
  "document-parse": "Document Parse",
  "document-classify": "Document Classify",
  "information-extract": "Information Extract",
  instruct: "Instruct",
};

type Placed = {
  step: Step;
  x: number;
  y: number;
  /** 이 노드로 들어오는 분기 조건 값. 없으면 무조건 경로다 */
  condition: string | null;
};

function layer(steps: Step[]): Map<string, number> {
  const byName = new Map(steps.map((step) => [step.name, step]));
  const depth = new Map<string, number>();
  const first = steps.find((step) => step.is_first) ?? steps[0];
  if (first) depth.set(first.name, 0);

  // 스텝 수가 열 개 남짓이라 완화 반복으로 충분하다. 사이클은 Config 규칙상 없다.
  for (let round = 0; round < steps.length; round += 1) {
    let moved = false;
    for (const step of steps) {
      const here = depth.get(step.name);
      if (here === undefined) continue;
      for (const next of step.next_steps) {
        if (!byName.has(next.step_name)) continue;
        const known = depth.get(next.step_name) ?? -1;
        if (known < here + 1) {
          depth.set(next.step_name, here + 1);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return depth;
}

function place(steps: Step[]): { nodes: Placed[]; width: number; height: number } {
  const depth = layer(steps);
  const columns: Step[][] = [];
  for (const step of steps) {
    const column = depth.get(step.name) ?? 0;
    (columns[column] ??= []).push(step);
  }

  const rows = Math.max(...columns.map((column) => column.length), 1);
  const height = rows * NODE_H + (rows - 1) * GAP_Y;
  const width = columns.length * NODE_W + (columns.length - 1) * GAP_X;

  const conditions = new Map<string, string | null>();
  for (const step of steps) {
    for (const next of step.next_steps) {
      // 조건이 있는 경로가 이긴다 — 기본 경로(조건 없음)는 마지막 분기라서
      // 먼저 덮어쓰면 라벨이 사라진다.
      if (next.condition && !conditions.get(next.step_name)) {
        conditions.set(next.step_name, next.condition.value);
      }
    }
  }

  const nodes: Placed[] = [];
  columns.forEach((column, index) => {
    const span = column.length * NODE_H + (column.length - 1) * GAP_Y;
    const top = (height - span) / 2;
    column.forEach((step, row) => {
      nodes.push({
        step,
        x: index * (NODE_W + GAP_X),
        y: top + row * (NODE_H + GAP_Y),
        condition: conditions.get(step.name) ?? null,
      });
    });
  });
  return { nodes, width, height };
}

export function Dag({ steps, title }: { steps: Step[]; title: string }) {
  const { nodes, width, height } = place(steps);
  const at = new Map(nodes.map((node) => [node.step.name, node]));
  const pad = 4;
  const markerId = `arrow-${title.replace(/\W/g, "")}`;

  const edges = nodes.flatMap((from) =>
    from.step.next_steps.flatMap((next) => {
      const to = at.get(next.step_name);
      if (!to) return [];
      const x1 = from.x + NODE_W;
      const y1 = from.y + NODE_H / 2;
      const x2 = to.x - 7;
      const y2 = to.y + NODE_H / 2;
      const bend = Math.max(24, GAP_X / 2);
      return [
        {
          key: `${from.step.name}->${next.step_name}`,
          d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
          dashed: Boolean(next.condition),
        },
      ];
    }),
  );

  return (
    // 넓은 그림은 자기 상자 안에서만 흐른다.
    <div className="overflow-x-auto rounded-xl border border-border bg-card/40 p-5">
      <svg
        viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`}
        width={width + pad * 2}
        height={height + pad * 2}
        role="img"
        aria-label={`${title} Upstage Studio 워크플로 구성도`}
        className="max-w-none"
      >
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1 L 7 4 L 0 7 z" className="fill-border" />
          </marker>
        </defs>

        {edges.map((edge) => (
          <path
            key={edge.key}
            d={edge.d}
            fill="none"
            strokeWidth="1.5"
            strokeDasharray={edge.dashed ? "4 3" : undefined}
            markerEnd={`url(#${markerId})`}
            className="stroke-border"
          />
        ))}

        {nodes.map((node) => (
          <g key={node.step.name}>
            <rect
              x={node.x}
              y={node.y}
              width={NODE_W}
              height={NODE_H}
              rx="8"
              strokeWidth="1"
              className={
                node.step.is_first
                  ? "fill-brand/8 stroke-brand/50"
                  : "fill-background stroke-border"
              }
            />
            <text
              x={node.x + 12}
              y={node.y + 19}
              className="fill-foreground font-mono text-[11px]"
            >
              {node.step.name}
            </text>
            <text
              x={node.x + 12}
              y={node.y + 33}
              className="fill-muted-foreground font-mono text-[9px]"
            >
              {TYPE_LABEL[node.step.type]}
            </text>
            {node.condition && (
              // 분기 조건은 줄을 따로 쓴다. 유형 뒤에 붙이면 클래스 이름이 잘린다.
              <text
                x={node.x + 12}
                y={node.y + 45}
                className="fill-brand/80 font-mono text-[9px]"
              >
                {node.condition}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** 스텝 유형별 개수. 그림 옆에 숫자로 한 번 더 적어 대조하게 한다 */
export function StepTally({ steps }: { steps: Step[] }) {
  const counts = new Map<Step["type"], number>();
  for (const step of steps) counts.set(step.type, (counts.get(step.type) ?? 0) + 1);
  return (
    <p className="mt-3 font-mono text-[11px] text-muted-foreground">
      {steps.length} steps ·{" "}
      {[...counts.entries()].map(([type, count]) => `${type} ${count}`).join(" · ")}
    </p>
  );
}
