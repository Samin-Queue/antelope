"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  FileText,
  Link2,
  Loader2,
  MinusCircle,
  XCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import type { ComposerSubmit } from "@/components/app/composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveScreen } from "@/app/(labs)/lab/notice/_lib/run-view";

import { NeedsForm } from "./needs-form";
import {
  APPLY_URL_KEY,
  PLAN_OWNER_LABEL,
  STAGE_LABEL,
  STAGES,
  type ApplyEvent,
  type FileInfo,
  type Need,
  type Plan,
  type Stage,
  type StartEvent,
} from "./types";

/**
 * 「목표 시작하기」 — 입력 하나로 요약부터 신청까지.
 *
 * 서버 스트림이 둘이다. /app/start/run 이 1~5 단계를, /app/start/apply 가 9단계를
 * 흘린다. 그 사이(6~8)는 여기서 정한다: 빈 항목이 없으면 사람을 안 거치고 바로 신청한다.
 */
type StageState = {
  status: "idle" | "running" | "done" | "error" | "skip";
  detail?: string;
};

type Prepared = {
  title: string;
  organization: string | null;
  deadline: string | null;
  applyUrl: string | null;
  needs: Need[];
};

type ApplyState = {
  status: "idle" | "running" | "done" | "error";
  /** 어느 브라우저가 도는지. 사람이 개입할 수 있는지가 여기서 갈린다 */
  mode: { mode: "auto" | "manual"; reason: string } | null;
  sessionId: string | null;
  frame: { image: string; url: string } | null;
  steps: string[];
  needHuman: string | null;
  summary: string | null;
  error: string | null;
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
  recover: "화면 복귀",
};

const IDLE_STAGES = Object.fromEntries(
  STAGES.map((stage) => [stage, { status: "idle" }]),
) as Record<Stage, StageState>;

export function StartFlow({ initial }: { initial: ComposerSubmit }) {
  const [stages, setStages] = useState<Record<Stage, StageState>>(IDLE_STAGES);
  const [logs, setLogs] = useState<string[]>([]);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [summary, setSummary] = useState<{ markdown: string; via: string } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [verdict, setVerdict] = useState<{
    verdict: "good" | "bad";
    reason: string;
  } | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [apply, setApply] = useState<ApplyState>({
    status: "idle",
    mode: null,
    sessionId: null,
    frame: null,
    steps: [],
    needHuman: null,
    summary: null,
    error: null,
  });
  // 서버가 만든 세션 id. 저장 책임은 서버에 있고 여기서는 갱신만 한다.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const startedRef = useRef(false);

  // 1~5 단계 — 컴포저 입력으로 한 번만 시작한다.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const body = new FormData();
    if (initial.kind === "file") body.append("file", initial.file);
    if (initial.kind === "url") body.append("url", initial.url);
    if (initial.kind === "text") body.append("text", initial.text);

    void readStream<StartEvent>("/app/start/run", body, (event) => {
      if (event.type === "stage") {
        setStages((prev) => ({
          ...prev,
          [event.stage]: {
            status: event.status === "start" ? "running" : event.status,
            detail: event.detail,
          },
        }));
      } else if (event.type === "log") {
        setLogs((prev) => [...prev, event.text]);
      } else if (event.type === "files") {
        setFiles(event.files);
      } else if (event.type === "summary") {
        setSummary({ markdown: event.markdown, via: event.via });
      } else if (event.type === "verdict") {
        setVerdict({ verdict: event.verdict, reason: event.reason });
      } else if (event.type === "plan") {
        setPlan(event.plan);
      } else if (event.type === "session") {
        setSessionId(event.id);
      } else if (event.type === "needs") {
        setPrepared({
          title: event.title,
          organization: event.organization,
          deadline: event.deadline,
          applyUrl: event.applyUrl,
          needs: event.needs,
        });
      } else if (event.type === "error") {
        setError(event.error);
      }
    })
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setPreparing(false));
  }, [initial]);

  // 7단계 — 빈 항목이 없으면 사람을 거치지 않는다.
  const autoRef = useRef(false);
  useEffect(() => {
    if (!prepared || autoRef.current) return;
    const missing = prepared.needs.filter(
      (need) => need.kind !== "file" && !need.value?.trim(),
    );
    if (missing.length === 0 && prepared.applyUrl) {
      autoRef.current = true;
      void startApply(
        prepared,
        Object.fromEntries(
          prepared.needs.filter((n) => n.value).map((n) => [n.label, n.value ?? ""]),
        ),
      );
    }
    // startApply 는 렌더마다 새로 만들어진다. 의존성에 넣으면 매 렌더 재실행되고,
    // autoRef 가 막더라도 의도가 흐려진다. prepared 가 정해질 때 한 번만 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);

  async function startApply(target: Prepared, values: Record<string, string>) {
    const applyUrl = values[APPLY_URL_KEY]?.trim() || target.applyUrl;
    if (!applyUrl) {
      setApply((prev) => ({ ...prev, status: "error", error: "신청 URL 이 없습니다." }));
      return;
    }
    // 입력한 값은 지식베이스에 남긴다 — 다음 공고에서 다시 묻지 않기 위해서다.
    const facts: Record<string, string> = {};
    const filled = target.needs.map((need) => {
      const value = values[need.key] ?? values[need.label] ?? need.value ?? "";
      if (value.trim() && need.kind !== "file" && need.key !== APPLY_URL_KEY) {
        facts[need.label] = value.trim();
      }
      return value.trim() && !need.value
        ? { ...need, value: value.trim(), from: "user" as const }
        : need;
    });
    void fetch("/lab/notice/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: facts, sourceNotice: target.title }),
    }).catch(() => {});
    // 마스터 테이블을 최신으로. 브라우저가 읽는 단일 진실이다.
    if (sessionId) {
      void fetch("/app/start/needs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, needs: filled }),
      }).catch(() => {});
    }

    setApply({
      status: "running",
      mode: null,
      sessionId: null,
      frame: null,
      steps: [],
      needHuman: null,
      summary: null,
      error: null,
    });

    try {
      await readStream<ApplyEvent>(
        "/app/start/apply",
        JSON.stringify({ applyUrl, title: target.title, facts }),
        (event) => {
          if (event.type === "mode") {
            setApply((prev) => ({
              ...prev,
              mode: { mode: event.mode, reason: event.reason },
            }));
          } else if (event.type === "session") {
            setApply((prev) => ({ ...prev, sessionId: event.sessionId }));
          } else if (event.type === "frame") {
            setApply((prev) => ({
              ...prev,
              frame: { image: event.image, url: event.title },
            }));
          } else if (event.type === "step") {
            const label = TOOL_LABEL[event.tool] ?? event.tool;
            setApply((prev) => ({
              ...prev,
              steps: [...prev.steps, `${label} ${event.detail}`].slice(-40),
            }));
          } else if (event.type === "need:human") {
            setApply((prev) => ({ ...prev, needHuman: event.reason }));
          } else if (event.type === "human:done") {
            setApply((prev) => ({ ...prev, needHuman: null }));
          } else if (event.type === "done") {
            setApply((prev) => ({ ...prev, status: "done", summary: event.summary }));
          } else if (event.type === "error") {
            setApply((prev) => ({ ...prev, status: "error", error: event.error }));
          }
        },
        { "Content-Type": "application/json" },
      );
    } catch (cause) {
      setApply((prev) => ({
        ...prev,
        status: "error",
        error: cause instanceof Error ? cause.message : String(cause),
      }));
    }
  }

  // 신청이 끝나면 세션 단계를 올린다.
  useEffect(() => {
    if (!sessionId || apply.status !== "done") return;
    void fetch("/app/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: sessionId,
        stage: "waiting",
        result: { summary: apply.summary },
      }),
    }).catch(() => {});
  }, [sessionId, apply.status, apply.summary]);

  const missingCount =
    prepared?.needs.filter((need) => need.kind !== "file" && !need.value?.trim())
      .length ?? 0;
  const showForm =
    prepared && apply.status === "idle" && (missingCount > 0 || !prepared.applyUrl);

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr] lg:items-start">
      <aside className="space-y-4 lg:sticky lg:top-6">
        <StageRail stages={stages} />
        {files.length > 0 && <FileList files={files} />}
        {logs.length > 0 && (
          <details className="rounded-xl border border-border bg-card px-3 py-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              에이전트 기록 {logs.length}
            </summary>
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto font-mono text-[11px] text-muted-foreground">
              {logs.map((line, index) => (
                <li key={index}>· {line}</li>
              ))}
            </ul>
          </details>
        )}
      </aside>

      <div className="space-y-6">
        {error && (
          <p className="rounded-lg bg-destructive/10 px-4 py-3 font-mono text-xs break-words whitespace-pre-wrap text-destructive">
            {error}
          </p>
        )}

        {preparing && !summary && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-brand" />
            입력을 읽고 요약하는 중
          </p>
        )}

        {summary && (
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">요약 · {summary.via}</Badge>
              {verdict && (
                <Badge variant={verdict.verdict === "good" ? "default" : "destructive"}>
                  {verdict.verdict === "good" ? "good" : "bad"}
                </Badge>
              )}
              {verdict && (
                <span className="text-xs text-muted-foreground">{verdict.reason}</span>
              )}
            </div>
            <article className="mt-4 max-w-none text-sm leading-6 break-words [&_a]:text-brand [&_a]:underline [&_h1]:mb-4 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:font-medium [&_li]:pl-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-1.5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summary.markdown}
              </ReactMarkdown>
            </article>
          </section>
        )}

        {plan && (plan.markdown || plan.steps.length > 0) && (
          <section className="rounded-2xl border border-border bg-card p-6">
            <Badge variant="secondary">진행 계획</Badge>
            {plan.steps.length > 0 && (
              <ol className="mt-4 space-y-2">
                {plan.steps.map((step, index) => (
                  <li
                    key={step.id}
                    className="flex flex-wrap items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{step.title}</p>
                      {step.detail && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {step.detail}
                        </p>
                      )}
                    </div>
                    <Badge variant={step.owner === "user" ? "default" : "outline"}>
                      {PLAN_OWNER_LABEL[step.owner]}
                    </Badge>
                    {step.dueDate && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {step.dueDate}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {plan.markdown && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  계획서 전문
                </summary>
                <article className="mt-3 max-w-none text-sm leading-6 break-words [&_a]:text-brand [&_a]:underline [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:pl-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {plan.markdown}
                  </ReactMarkdown>
                </article>
              </details>
            )}
          </section>
        )}

        {prepared && (
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-medium">{prepared.title}</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <Meta label="주관" value={prepared.organization} />
              <Meta label="마감" value={prepared.deadline?.replace("T", " ") ?? null} />
              <Meta
                label="신청 페이지"
                value={prepared.applyUrl}
                icon={<Link2 className="size-3" />}
              />
            </dl>
          </section>
        )}

        {showForm && (
          <NeedsForm
            needs={prepared.needs}
            onSubmit={(values) => void startApply(prepared, values)}
          />
        )}

        {prepared && apply.status !== "idle" && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">자동 신청</h2>
              {apply.mode && (
                <Badge variant={apply.mode.mode === "auto" ? "default" : "secondary"}>
                  {apply.mode.mode === "auto" ? "자동 · Playwright" : "직접 조작 · 캡챠"}
                </Badge>
              )}
              {missingCount === 0 && !apply.mode && (
                <span className="text-xs text-muted-foreground">
                  입력할 게 없어 바로 진행했다
                </span>
              )}
              {apply.status === "running" && (
                <Loader2 className="ml-auto size-4 animate-spin text-brand" />
              )}
            </div>
            {apply.mode && (
              <p className="text-xs text-muted-foreground">{apply.mode.reason}</p>
            )}
            <LiveScreen
              frame={apply.frame}
              running={apply.status === "running"}
              sessionId={apply.sessionId}
              needHuman={apply.needHuman}
              onHumanDone={() => setApply((prev) => ({ ...prev, needHuman: null }))}
            />
            {apply.steps.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-card px-3 py-2 font-mono text-[11px] text-muted-foreground">
                {apply.steps.map((step, index) => (
                  <li key={index} className="truncate">
                    {step}
                  </li>
                ))}
              </ul>
            )}
            {apply.summary && (
              <div className="rounded-xl border border-brand/40 bg-brand/5 p-4 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-brand">
                  <CheckCircle2 className="size-4" />
                  신청 완료
                </p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {apply.summary}
                </p>
              </div>
            )}
            {apply.error && (
              <p className="rounded-lg bg-destructive/10 px-4 py-3 font-mono text-xs break-words text-destructive">
                {apply.error}
              </p>
            )}
            {apply.status === "error" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void startApply(
                    prepared,
                    Object.fromEntries(
                      prepared.needs
                        .filter((n) => n.value)
                        .map((n) => [n.key, n.value ?? ""]),
                    ),
                  )
                }
              >
                다시 시도
              </Button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * SSE 를 직접 읽는다. EventSource 는 POST 를 못 보내고, 파일은 POST 로만 간다.
 */
async function readStream<T>(
  url: string,
  body: BodyInit,
  onEvent: (event: T) => void,
  headers?: Record<string, string>,
) {
  const response = await fetch(url, { method: "POST", body, headers });
  if (!response.ok || !response.body) {
    const json = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(json?.error ?? `HTTP ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      onEvent(JSON.parse(line.slice(6)) as T);
    }
  }
}

function StageRail({ stages }: { stages: Record<Stage, StageState> }) {
  return (
    <ol className="space-y-1 rounded-xl border border-border bg-card p-2">
      {STAGES.map((id, index) => {
        const state = stages[id];
        const Icon =
          state.status === "done"
            ? CheckCircle2
            : state.status === "error"
              ? XCircle
              : state.status === "skip"
                ? MinusCircle
                : state.status === "running"
                  ? Loader2
                  : CircleDashed;
        return (
          <li
            key={id}
            className={cn(
              "flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs",
              state.status === "running" && "bg-brand/5",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-3.5 shrink-0",
                state.status === "done" && "text-brand",
                state.status === "error" && "text-destructive",
                state.status === "running" && "animate-spin text-brand",
                (state.status === "idle" || state.status === "skip") &&
                  "text-muted-foreground/50",
              )}
            />
            <div className="min-w-0">
              <p
                className={cn(
                  state.status === "idle" && "text-muted-foreground",
                  state.status === "skip" && "text-muted-foreground line-through",
                )}
              >
                {index + 1}. {STAGE_LABEL[id].title}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {STAGE_LABEL[id].agent}
              </p>
              {state.detail && (
                <p className="mt-0.5 text-[10px] break-words text-destructive">
                  {state.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const ORIGIN_LABEL: Record<FileInfo["origin"], string> = {
  upload: "업로드",
  url: "링크",
  crawl: "조사",
};

function FileList({ files }: { files: FileInfo[] }) {
  return (
    <ul className="space-y-1 rounded-xl border border-border bg-card p-2 text-xs">
      {files.map((file) => (
        <li
          key={`${file.origin}:${file.name}`}
          className="flex items-center gap-1.5 px-2 py-1"
        >
          <FileText className="size-3.5 shrink-0 text-brand" />
          <span className="truncate">{file.name}</span>
          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
            {ORIGIN_LABEL[file.origin]}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Meta({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "flex items-center gap-1 truncate text-sm",
          !value && "text-muted-foreground",
        )}
      >
        {icon}
        {value ?? "미확인"}
      </dd>
    </div>
  );
}
