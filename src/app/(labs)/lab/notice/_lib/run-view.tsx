"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Hand,
  HelpCircle,
  Loader2,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Evidence } from "./evidence";
import { Cite, EvidencePanel } from "./evidence-view";
import type { Notice } from "./schema";
import {
  AGENT_LABEL,
  LIVE_SCREEN,
  type AgentId,
  type LiveInput,
  type PipelineResult,
  type RunEvent,
} from "./types";

type AgentState = {
  status: "idle" | "running" | "done" | "error";
  ms?: number;
  error?: string;
  /** 브라우저 에이전트의 최근 조작. 무엇을 클릭하고 있는지 보여야 한다 */
  steps?: string[];
};

const IDLE: Record<AgentId, AgentState> = {
  eligibility: { status: "idle" },
  documents: { status: "idle" },
  outline: { status: "idle" },
  browser: { status: "idle" },
};

const TOOL_LABEL: Record<string, string> = {
  read: "화면 읽기",
  click: "클릭",
  click_at: "좌표 클릭",
  type: "입력",
  select: "선택",
  press: "키",
  scroll: "스크롤",
  "need:human": "사람 호출",
};

const ORIGIN_LABEL = {
  hold: "보유",
  issue: "발급",
  write: "작성",
} as const;

const OVERALL = {
  eligible: { label: "신청 가능", tone: "text-brand" },
  unclear: { label: "확인 필요", tone: "text-amber-500" },
  ineligible: { label: "신청 불가", tone: "text-destructive" },
} as const;

export function RunView({
  notice,
  profile,
  goalId,
  evidence = [],
  cited = [],
}: {
  notice: Notice;
  profile: Record<string, string>;
  /** 로그인·DB 가 없으면 null. 그때는 목표를 남기지 않고 그냥 돈다 */
  goalId?: string | null;
  /** 원문 좌표. Studio 를 탄 파일 입력에만 있다 */
  evidence?: Evidence[];
  cited?: Evidence[];
}) {
  const router = useRouter();
  const [states, setStates] = useState<Record<AgentId, AgentState>>(IDLE);
  const [agents, setAgents] = useState<AgentId[]>([
    "eligibility",
    "documents",
    "outline",
  ]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [frame, setFrame] = useState<{ image: string; url: string } | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  /** 브라우저 에이전트의 가상 데스크톱. 라이브 뷰와 조작이 여기 붙는다 */
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [needHuman, setNeedHuman] = useState<string | null>(null);

  /**
   * 파이프라인 결과를 목표에 남긴다.
   *
   * 자격 미달은 그 자리에서 끝난 목표다 — 「지난 목표」에서 왜 접었는지 보이도록
   * outcome 까지 박는다. 나머지는 아직 작업 중이다.
   */
  function saveGoal(value: PipelineResult) {
    if (!goalId) return;
    const ineligible = value.eligibility?.overall === "ineligible";
    void fetch("/app/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: goalId,
        stage: ineligible ? "closed" : "working",
        outcome: ineligible ? "ineligible" : null,
        result: value,
      }),
    })
      // 서버에서 그리는 「지난 목표」 탭이 새 값을 읽도록 한 번 새로 고친다.
      .then(() => router.refresh())
      .catch(() => {});
  }

  async function run() {
    if (running) return;
    setRunning(true);
    setResult(null);
    setTotalMs(null);
    setStates(IDLE);
    setFrame(null);
    setSessionId(null);
    setNeedHuman(null);

    const response = await fetch("/lab/notice/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notice, profile }),
    });

    if (!response.body) {
      setRunning(false);
      return;
    }

    // SSE 를 직접 읽는다. EventSource 는 POST 를 못 보낸다.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const line = chunk.trim();
        if (!line.startsWith("data: ")) continue;
        const event = JSON.parse(line.slice(6)) as RunEvent;

        if (event.type === "start") {
          setAgents(event.agents);
        } else if (event.type === "frame") {
          setFrame({ image: event.image, url: event.url });
        } else if (event.type === "session") {
          setSessionId(event.sessionId);
        } else if (event.type === "need:human") {
          setNeedHuman(event.reason);
        } else if (event.type === "human:done") {
          setNeedHuman(null);
        } else if (event.type === "agent:step") {
          setStates((prev) => ({
            ...prev,
            [event.agent]: {
              ...prev[event.agent],
              status: "running",
              steps: [
                ...(prev[event.agent].steps ?? []).slice(-5),
                `${TOOL_LABEL[event.tool] ?? event.tool} ${event.detail}`,
              ],
            },
          }));
        } else if (event.type === "agent:start") {
          setStates((prev) => ({ ...prev, [event.agent]: { status: "running" } }));
        } else if (event.type === "agent:done") {
          setStates((prev) => ({
            ...prev,
            [event.agent]: { status: "done", ms: event.ms },
          }));
        } else if (event.type === "agent:error") {
          setStates((prev) => ({
            ...prev,
            [event.agent]: { status: "error", error: event.error },
          }));
        } else if (event.type === "result") {
          setResult(event.result);
          saveGoal(event.result);
        } else if (event.type === "end") {
          setTotalMs(event.ms);
        }
      }
    }
    setRunning(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={running}>
          {running && <Loader2 className="animate-spin" />}
          {running ? "에이전트 실행 중" : "신청 준비 시작"}
        </Button>
        {totalMs !== null && (
          <span className="font-mono text-xs text-muted-foreground">
            전체 {(totalMs / 1000).toFixed(1)}초
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <LiveScreen
          frame={frame}
          running={running}
          sessionId={sessionId}
          needHuman={needHuman}
          onHumanDone={() => setNeedHuman(null)}
        />
        <ul className="space-y-2.5">
          {agents.map((id) => (
            <AgentCard key={id} id={id} state={states[id]} />
          ))}
        </ul>
      </div>

      {result && (
        <ResultView result={result} notice={notice} evidence={evidence} cited={cited} />
      )}
    </div>
  );
}

/**
 * 에이전트가 조작 중인 실제 화면 — 그리고 필요하면 사람이 넘겨받는 곳.
 *
 * 평소에는 에이전트가 보내는 프레임을 그린다. 세션이 생기면 /lab/notice/live 에
 * 붙어 가상 데스크톱을 그대로 스트리밍하고, 「직접 조작」을 켜면 클릭·키·스크롤이
 * 그 데스크톱의 X 서버로 들어간다. 캡챠가 뜨면 에이전트가 먼저 멈추고 이걸 켠다.
 */
export function LiveScreen({
  frame,
  running,
  sessionId,
  needHuman,
  onHumanDone,
}: {
  frame: { image: string; url: string } | null;
  running: boolean;
  sessionId: string | null;
  needHuman: string | null;
  onHumanDone: () => void;
}) {
  const [live, setLive] = useState<string | null>(null);
  const [manualByUser, setManualByUser] = useState(false);
  // 캡챠 등으로 에이전트가 멈추면 조작권은 자동으로 사람에게 온다 — 효과가 아니라 파생값이다
  const manual = manualByUser || needHuman !== null;
  const imgRef = useRef<HTMLImageElement>(null);
  const dragFrom = useRef<{ x: number; y: number } | null>(null);

  // 세션이 생기면 라이브 스트림에 붙는다. 화면이 바뀐 프레임만 온다.
  useEffect(() => {
    if (!sessionId) return;
    const source = new EventSource(
      `/lab/notice/live?session=${encodeURIComponent(sessionId)}`,
    );
    source.addEventListener("frame", (e) =>
      setLive(`data:image/jpeg;base64,${(e as MessageEvent).data}`),
    );
    source.addEventListener("error", () => source.close());
    return () => source.close();
  }, [sessionId]);

  const send = (input: LiveInput | { kind: "hold"; held: boolean }) => {
    if (!sessionId) return;
    void fetch(`/lab/notice/control?session=${encodeURIComponent(sessionId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  };

  const toggleManual = (next: boolean) => {
    setManualByUser(next);
    send({ kind: "hold", held: next });
    if (!next) onHumanDone();
  };

  /** 표시 크기 → 가상 데스크톱 픽셀 */
  const toScreen = (e: React.MouseEvent) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * LIVE_SCREEN.width,
      y: ((e.clientY - rect.top) / rect.height) * LIVE_SCREEN.height,
    };
  };

  const image = live ?? frame?.image ?? null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {frame?.url ?? "about:blank"}
        </span>
        <span className="ml-auto flex items-center gap-3">
          {running && image && !manual && (
            <span className="flex items-center gap-1.5 text-xs text-brand">
              <span className="size-1.5 animate-pulse rounded-full bg-brand" />
              LIVE
            </span>
          )}
          {sessionId && (
            <Button
              size="xs"
              variant={manual ? "default" : "outline"}
              onClick={() => toggleManual(!manual)}
            >
              <Hand />
              {manual ? "에이전트에게 돌려주기" : "직접 조작"}
            </Button>
          )}
        </span>
      </div>

      {needHuman && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <Hand className="size-3.5" />
          {needHuman} 끝나면 「에이전트에게 돌려주기」를 누르세요.
        </div>
      )}

      <div
        className={cn(
          "relative aspect-[16/10] bg-muted/30 select-none",
          manual && "cursor-crosshair ring-2 ring-brand ring-inset",
        )}
        tabIndex={manual ? 0 : -1}
        onKeyDown={(e) => {
          if (!manual) return;
          e.preventDefault();
          // 글자 하나는 type 으로, 나머지는 X 키 이름으로 보낸다
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            send({ kind: "type", text: e.key });
          } else {
            const map: Record<string, string> = {
              Enter: "Return",
              Backspace: "BackSpace",
              ArrowUp: "Up",
              ArrowDown: "Down",
              ArrowLeft: "Left",
              ArrowRight: "Right",
              " ": "space",
            };
            const key = map[e.key] ?? e.key;
            send({ kind: "key", key: e.ctrlKey ? `ctrl+${key.toLowerCase()}` : key });
          }
        }}
        onWheel={(e) => {
          if (!manual) return;
          const p = toScreen(e);
          if (p) send({ kind: "scroll", x: p.x, y: p.y, dy: e.deltaY });
        }}
        onMouseDown={(e) => {
          if (!manual) return;
          dragFrom.current = toScreen(e);
          (e.currentTarget as HTMLDivElement).focus();
        }}
        onMouseUp={(e) => {
          if (!manual) return;
          const from = dragFrom.current;
          const to = toScreen(e);
          dragFrom.current = null;
          if (!from || !to) return;
          const moved = Math.hypot(to.x - from.x, to.y - from.y) > 6;
          if (moved) send({ kind: "drag", x: from.x, y: from.y, toX: to.x, toY: to.y });
          else if (e.detail >= 2) send({ kind: "dblclick", x: to.x, y: to.y });
          else send({ kind: "click", x: to.x, y: to.y });
        }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={image}
            alt="에이전트가 조작 중인 화면"
            draggable={false}
            className="size-full object-cover object-top"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
            {running ? "브라우저 준비 중" : "신청 URL 이 있으면 여기에 실제 화면이 뜬다"}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ id, state }: { id: AgentId; state: AgentState }) {
  return (
    <li
      className={cn(
        "rounded-2xl border bg-card p-4 transition-colors",
        state.status === "running" && "border-brand",
        state.status === "done" && "border-brand/40",
        state.status === "error" && "border-destructive/50",
        state.status === "idle" && "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        {state.status === "running" ? (
          <Loader2 className="size-4 animate-spin text-brand" />
        ) : state.status === "done" ? (
          <CheckCircle2 className="size-4 text-brand" />
        ) : state.status === "error" ? (
          <XCircle className="size-4 text-destructive" />
        ) : (
          <CircleDashed className="size-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">{AGENT_LABEL[id]}</span>
        {state.ms !== undefined && (
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {(state.ms / 1000).toFixed(1)}초
          </span>
        )}
      </div>
      {state.error && (
        <p className="mt-2 font-mono text-xs break-words text-destructive">
          {state.error}
        </p>
      )}
    </li>
  );
}

function ResultView({
  result,
  notice,
  evidence,
  cited,
}: {
  result: PipelineResult;
  notice: Notice;
  evidence: Evidence[];
  cited: Evidence[];
}) {
  const { eligibility, documents, outline, browser } = result;

  /**
   * 판정에 걸린 요건의 원문 문장.
   *
   * 판정문은 모델이 쓴 말이라 원문과 글자가 다르다. 추출 단계에서 요건마다
   * 받아 둔 `source` 를 통해 원문으로 되돌린다 — 그게 실제로 문서에 있던 문장이다.
   */
  const sourceOf = (requirement: string): string =>
    notice.requirements.find((item) => item.text === requirement)?.source ?? requirement;

  return (
    <div className="space-y-6">
      {eligibility && (
        <div className="grid gap-4 lg:grid-cols-[1fr_19rem] lg:items-start">
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">자격 판정</h3>
              <span
                className={cn("text-sm font-medium", OVERALL[eligibility.overall].tone)}
              >
                {OVERALL[eligibility.overall].label}
              </span>
            </div>
            <ul className="mt-4 space-y-2">
              {eligibility.verdicts.map((item) => (
                <li key={item.requirement} className="rounded-lg bg-muted/40 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    {item.status === "meets" ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
                    ) : item.status === "fails" ? (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <HelpCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    )}
                    <div className="min-w-0">
                      <Cite
                        label="자격 요건"
                        needle={sourceOf(item.requirement)}
                        className="text-sm"
                      >
                        {item.requirement}
                      </Cite>
                      {item.reason && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.reason}
                        </p>
                      )}
                      {item.needsFromUser && (
                        <p className="mt-1 text-xs text-amber-500">
                          확인 필요 — {item.needsFromUser}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          {evidence.length > 0 && (
            <div className="lg:sticky lg:top-6">
              <EvidencePanel evidence={evidence} cited={cited} />
            </div>
          )}
        </div>
      )}

      {documents && documents.items.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium">서류 준비</h3>
          <ul className="mt-4 space-y-2">
            {documents.items.map((item) => (
              <li key={item.name} className="rounded-lg bg-muted/40 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.origin === "write" ? "default" : "secondary"}>
                    {ORIGIN_LABEL[item.origin]}
                  </Badge>
                  <span className="text-sm">{item.name}</span>
                  {item.canAutomate && <Badge variant="outline">자동 작성 가능</Badge>}
                  {item.estimatedMinutes !== null && (
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      ~{item.estimatedMinutes}분
                    </span>
                  )}
                </div>
                {item.how && (
                  <p className="mt-1 text-xs text-muted-foreground">{item.how}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {browser && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium">신청 폼 작성</h3>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {browser.steps}스텝 · {browser.finalUrl}
          </p>
          <ol className="mt-4 space-y-1">
            {browser.trace.map((entry) => (
              <li key={entry.step} className="flex gap-2 text-xs">
                <span className="w-5 shrink-0 text-right font-mono text-muted-foreground">
                  {entry.step}
                </span>
                <span className="w-12 shrink-0 text-brand">
                  {TOOL_LABEL[entry.tool] ?? entry.tool}
                </span>
                <span className="min-w-0 truncate font-mono text-muted-foreground">
                  {JSON.stringify(entry.input)}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm whitespace-pre-wrap">{browser.summary}</p>
        </section>
      )}

      {outline && outline.sections.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium">신청서 설계</h3>
          <ul className="mt-4 space-y-3">
            {outline.sections.map((section) => (
              <li key={section.heading} className="rounded-lg bg-muted/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{section.heading}</span>
                  {section.points !== null && (
                    <span className="ml-auto font-mono text-xs text-brand">
                      {section.points}점
                    </span>
                  )}
                </div>
                {section.whatTheyWant && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {section.whatTheyWant}
                  </p>
                )}
                <ul className="mt-2 space-y-1">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="text-xs text-muted-foreground">
                      · {bullet}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
