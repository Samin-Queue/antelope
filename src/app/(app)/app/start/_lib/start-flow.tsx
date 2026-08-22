"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Link2, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import type { ComposerSubmit } from "@/components/app/composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LiveScreen } from "@/app/(labs)/lab/notice/_lib/run-view";

import { AgentCard, AgentGrid, emptyCards, type Cards } from "./agent-grid";
import { AskDialog, type AskItem } from "./ask-dialog";
import { NeedsForm } from "./needs-form";
import { SteerBox } from "./steer-box";
import {
  APPLY_URL_KEY,
  PLAN_OWNER_LABEL,
  type AgentKey,
  type ApplyEvent,
  type Artifact,
  type FileInfo,
  type Need,
  type Plan,
  type StartEvent,
} from "./types";

/**
 * 「세션 시작하기」 — 입력 하나로 요약부터 신청까지.
 *
 * 화면의 요점은 **무엇이 지금 돌고 있는지가 보이는 것**이다. 진행 막대 하나로는
 * 잘 가고 있는지 멈춘 건지 알 수 없다 — CLI 가 모델의 사고를 흘리는 것과 같은
 * 이유로 카드마다 그 에이전트가 방금 한 일을 흘린다.
 *
 * 서버 스트림이 둘이다. `/run` 이 준비 8단계를, `/apply` 가 신청을 흘린다.
 * 둘이 같은 `AgentKey` 어휘를 쓰므로 하나의 격자가 이어서 그려진다 — 브라우저가
 * 도중에 데이터·파일·계획을 되부르면 그 칸이 함께 켜진다.
 */
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
  fill: "입력",
  type: "입력",
  select: "선택",
  press: "키",
  scroll: "스크롤",
  upload: "파일 첨부",
  diagnose: "막힌 이유 확인",
  askUser: "사용자에게 질문",
  makeFile: "서류 작성 요청",
  replan: "계획 재수립",
  "need:human": "사람 호출",
  recover: "화면 복귀",
};

export function StartFlow({ initial }: { initial: ComposerSubmit }) {
  const [cards, setCards] = useState<Cards>(emptyCards);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [summary, setSummary] = useState<{ markdown: string; via: string } | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  /**
   * 사용자가 입력한 값. 폼이 아니라 여기에 둔다.
   *
   * 폼은 Dialog 안에 있어서 닫히면 언마운트된다. 값이 폼 안에 있었을 때는
   * 제출 실패·Esc·바깥 클릭 어느 쪽이든 입력이 통째로 사라지고, 다시 열면
   * 선채움된 값만 남았다. 여기 두면 다이얼로그가 몇 번 닫혀도 살아 있다.
   */
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [needsOpen, setNeedsOpen] = useState(false);
  const [ask, setAsk] = useState<AskItem | null>(null);
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const startedRef = useRef(false);

  /** 카드 하나를 고친다. 다른 카드는 건드리지 않는다 */
  const patch = (agent: AgentKey, next: Partial<Cards[AgentKey]>) =>
    setCards((prev) => ({ ...prev, [agent]: { ...prev[agent], ...next } }));

  const pushLog = (agent: AgentKey, text: string) =>
    setCards((prev) => ({
      ...prev,
      // 카드 안쪽만 스크롤하므로 다 쌓아도 되지만, 긴 실행에서 메모리가 는다.
      [agent]: { ...prev[agent], logs: [...prev[agent].logs, text].slice(-60) },
    }));

  // 준비 — 컴포저 입력으로 한 번만 시작한다.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const body = new FormData();
    if (initial.kind === "file") body.append("file", initial.file);
    if (initial.kind === "url") body.append("url", initial.url);
    if (initial.kind === "text") body.append("text", initial.text);

    void readStream<StartEvent>("/app/start/run", body, (event) => {
      switch (event.type) {
        case "stage":
          patch(event.stage, {
            status: event.status === "start" ? "running" : event.status,
            detail: event.detail,
          });
          break;
        case "log":
          if (event.stage) pushLog(event.stage, event.text);
          break;
        case "files":
          setFiles(event.files);
          patch("research", { output: `자료 ${event.files.length}개` });
          break;
        case "summary":
          setSummary({ markdown: event.markdown, via: event.via });
          // 파일이 없으면 Studio 를 못 탄다. 실제로 무엇이 돌았는지 적는다.
          patch("summarize", { via: event.via, output: `${event.via}` });
          break;
        case "brief":
          setBrief(event.markdown);
          patch("analyze", {
            output: `준비 문서 ${event.markdown.length.toLocaleString()}자`,
          });
          break;
        case "verdict":
          patch("judge", {
            output: event.verdict === "good" ? "착수 가능" : "정보 부족",
          });
          break;
        case "plan":
          setPlan(event.plan);
          patch("plan", { output: `${event.plan.steps.length}단계` });
          break;
        case "artifacts":
          setArtifacts(event.artifacts);
          patch("documents", { output: `파일 ${event.artifacts.length}개` });
          break;
        case "run":
          setRunId(event.runId);
          break;
        case "session":
          setSessionId(event.id);
          break;
        case "needs": {
          setPrepared({
            title: event.title,
            organization: event.organization,
            deadline: event.deadline,
            applyUrl: event.applyUrl,
            needs: event.needs,
          });
          // 선채움 값을 초깃값으로 깐다. 이미 사용자가 친 것이 있으면 그쪽을
          // 남긴다 — 늦게 도착한 이벤트가 입력을 덮어쓰면 안 된다.
          setValues((prev) => ({
            ...Object.fromEntries(
              event.needs.filter((n) => n.value).map((n) => [n.key, n.value ?? ""]),
            ),
            ...prev,
          }));
          const filled = event.needs.filter((need) => need.value?.trim()).length;
          patch("prefill", { output: `${filled}/${event.needs.length} 채움` });
          break;
        }
        case "error":
          setError(event.error);
          break;
      }
    })
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setPreparing(false));
  }, [initial]);

  // 빈 항목이 없으면 사람을 거치지 않는다. 있으면 다이얼로그를 띄운다.
  const autoRef = useRef(false);
  useEffect(() => {
    if (!prepared || autoRef.current) return;
    autoRef.current = true;
    const missing = prepared.needs.filter(
      (need) => need.kind !== "file" && !need.value?.trim(),
    );
    if (missing.length === 0 && prepared.applyUrl) {
      void startApply(
        prepared,
        Object.fromEntries(
          prepared.needs.filter((n) => n.value).map((n) => [n.label, n.value ?? ""]),
        ),
      );
    } else {
      setNeedsOpen(true);
    }
    // startApply 는 매 렌더 새로 만들어진다. prepared 가 올 때 한 번만 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);

  async function startApply(target: Prepared, values: Record<string, string>) {
    const applyUrl = values[APPLY_URL_KEY]?.trim() || target.applyUrl;
    if (!applyUrl) {
      setApply((prev) => ({ ...prev, status: "error", error: "신청 URL 이 없습니다." }));
      return;
    }
    setNeedsOpen(false);

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

    // 입력한 값은 지식베이스에 남긴다 — 다음 공고에서 다시 묻지 않기 위해서다.
    void fetch("/lab/notice/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: facts, sourceNotice: target.title }),
    }).catch(() => {});
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
        JSON.stringify({
          applyUrl,
          title: target.title,
          facts,
          runId,
          needs: filled,
          brief,
          organization: target.organization,
          deadline: target.deadline,
          plan: plan
            ? {
                browser: plan.steps
                  .filter((step) => step.owner === "browser")
                  .map((step) => [step.title, step.detail].filter(Boolean).join(" — ")),
                // file 도 지금은 사람 몫이다 — 파일 에이전트가 생기면 빼야 한다.
                human: plan.steps
                  .filter((step) => step.owner === "user" || step.owner === "file")
                  .map((step) => step.title),
              }
            : undefined,
          artifacts: artifacts.map((item) => ({
            label: item.label,
            filename: item.filename,
            path: item.path,
          })),
        }),
        (event) => {
          switch (event.type) {
            case "mode":
              setApply((prev) => ({ ...prev, mode: event }));
              break;
            case "session":
              setApply((prev) => ({ ...prev, sessionId: event.sessionId }));
              break;
            case "agent":
              // 브라우저가 되부른 에이전트. 브라우저 카드와 함께 켜진다.
              patch(event.agent, {
                status: event.status === "start" ? "running" : event.status,
                detail: event.detail,
              });
              if (event.status === "start" && event.detail) {
                pushLog(event.agent, event.detail);
              }
              break;
            case "ask":
              setAsk({ id: event.id, label: event.label, why: event.why });
              break;
            case "answered":
              setAsk((prev) => (prev?.id === event.id ? null : prev));
              break;
            case "frame":
              setApply((prev) => ({
                ...prev,
                frame: { image: event.image, url: event.title },
              }));
              break;
            case "step": {
              const label = TOOL_LABEL[event.tool] ?? event.tool;
              const line = `${label} ${event.detail}`;
              setApply((prev) => ({ ...prev, steps: [...prev.steps, line].slice(-60) }));
              pushLog("browser", line);
              break;
            }
            case "need:human":
              setApply((prev) => ({ ...prev, needHuman: event.reason }));
              break;
            case "human:done":
              setApply((prev) => ({ ...prev, needHuman: null }));
              break;
            case "done":
              setApply((prev) => ({ ...prev, status: "done", summary: event.summary }));
              break;
            case "error":
              setApply((prev) => ({ ...prev, status: "error", error: event.error }));
              break;
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

  const answer = (id: string, value: string | null) => {
    setAsk(null);
    void fetch("/app/start/steer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "answer", runId, id, value }),
    }).catch(() => {});
  };

  const steer = (text: string, mode: "now" | "next") => {
    pushLog("browser", `사용자 지시: ${text}`);
    void fetch("/app/start/steer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "steer", runId, text, mode }),
    }).catch(() => {});
  };

  const running = preparing || apply.status === "running";

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)]">
      <div className="min-w-0 flex-1 space-y-4 px-6 py-6">
        <header className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-medium">{prepared?.title ?? "공고를 읽는 중"}</h1>
          {prepared?.organization && (
            <span className="text-sm text-muted-foreground">{prepared.organization}</span>
          )}
          {prepared?.deadline && (
            <Badge variant="secondary">{prepared.deadline.replace("T", " ")}</Badge>
          )}
          {prepared?.applyUrl && (
            <a
              href={prepared.applyUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-brand hover:underline"
            >
              <Link2 className="size-3" />
              신청 페이지
            </a>
          )}
          {running && <Loader2 className="ml-auto size-4 animate-spin text-brand" />}
        </header>

        <AgentGrid cards={cards} />

        <SteerBox disabled={!runId || apply.status !== "running"} onSend={steer} />

        {(apply.status !== "idle" || cards.browser.status !== "idle") && (
          <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-2">
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
            </div>
            <AgentCard
              agent="browser"
              state={cards.browser}
              className="h-full min-h-56"
            />
          </div>
        )}

        {apply.summary && (
          <section className="rounded-xl border border-brand/40 bg-brand/5 p-4 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-brand">
              <CheckCircle2 className="size-4" />
              신청 결과
            </p>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
              {apply.summary}
            </p>
          </section>
        )}

        {(apply.error || error) && (
          <p className="rounded-lg bg-destructive/10 px-4 py-3 font-mono text-xs break-words text-destructive">
            {apply.error ?? error}
          </p>
        )}

        {/* 실패한 뒤에도 폼으로 돌아갈 수 있어야 한다. `idle` 만 허용했을 때는
            신청이 한 번 깨지면 에러 문구만 남고 되돌아갈 길이 없었다. */}
        {prepared &&
          !needsOpen &&
          (apply.status === "idle" || apply.status === "error") && (
            <Button onClick={() => setNeedsOpen(true)}>
              {apply.status === "error" ? "입력 고치고 다시 신청" : "입력 확인하고 신청"}
            </Button>
          )}

        <Dialog open={needsOpen} onOpenChange={setNeedsOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>신청에 필요한 정보</DialogTitle>
            </DialogHeader>
            {prepared && (
              <NeedsForm
                needs={prepared.needs}
                values={values}
                onChange={(key, value) =>
                  setValues((prev) => ({ ...prev, [key]: value }))
                }
                artifacts={artifacts}
                runId={runId}
                sourceNotice={prepared.title}
                onUpload={(artifact) =>
                  setArtifacts((prev) => [
                    ...prev.filter((item) => item.needKey !== artifact.needKey),
                    artifact,
                  ])
                }
                onSubmit={() => void startApply(prepared, values)}
              />
            )}
          </DialogContent>
        </Dialog>

        <AskDialog item={ask} onAnswer={answer} />
      </div>

      {/* 산출물은 오른쪽에 세워 둔다. 아래에 접어 두면 스크롤해야 보이고,
          그러면 격자에서 눈을 떼야 한다 — 진행과 결과를 같이 봐야 한다. */}
      <Details
        summary={summary}
        brief={brief}
        plan={plan}
        files={files}
        artifacts={artifacts}
      />
    </div>
  );
}

/** 산출물 전문. 카드에는 한 줄 요약만 두고 자세한 건 여기서 편다 */
function Details({
  summary,
  brief,
  plan,
  files,
  artifacts,
}: {
  summary: { markdown: string; via: string } | null;
  brief: string | null;
  plan: Plan | null;
  files: FileInfo[];
  artifacts: Artifact[];
}) {
  if (!summary && !brief && !plan && files.length === 0) return null;

  return (
    <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-80 shrink-0 space-y-2 overflow-y-auto border-l border-border/60 px-4 py-6 xl:block">
      {plan && plan.steps.length > 0 && (
        <Block title={`진행 계획 ${plan.steps.length}단계`} open>
          <ol className="space-y-1.5">
            {plan.steps.map((step, index) => (
              <li
                key={step.id}
                className="flex flex-wrap items-start gap-2 rounded-lg bg-muted/40 px-3 py-2"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{step.title}</p>
                  {step.detail && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
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
        </Block>
      )}

      {artifacts.length > 0 && (
        <Block title={`작성한 서류 ${artifacts.length}`}>
          <ul className="space-y-1.5">
            {artifacts.map((item) => (
              <li
                key={item.needKey}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
              >
                <span className="truncate">{item.filename}</span>
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {(item.bytes / 1024).toFixed(0)}KB
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {brief && (
        <Block title="신청 준비 문서">
          <Prose markdown={brief} />
        </Block>
      )}

      {summary && (
        <Block title={`요약 · ${summary.via}`}>
          <Prose markdown={summary.markdown} />
        </Block>
      )}

      {files.length > 0 && (
        <Block title={`모아 온 자료 ${files.length}`}>
          <ul className="space-y-1 text-sm">
            {files.map((file) => (
              <li
                key={`${file.origin}-${file.name}`}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2"
              >
                <span className="truncate">{file.name}</span>
                <Badge variant="outline">{file.origin}</Badge>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {(file.bytes / 1024).toFixed(0)}KB
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </aside>
  );
}

function Block({
  title,
  open,
  children,
}: {
  title: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      className="rounded-xl border border-border bg-card px-4 py-3 [&[open]>summary]:mb-3"
    >
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      {children}
    </details>
  );
}

function Prose({ markdown }: { markdown: string }) {
  return (
    <article
      className={cn(
        "max-w-none text-sm leading-6 break-words",
        "[&_a]:text-brand [&_a]:underline [&_h1]:mb-3 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_li]:pl-1",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5",
        "[&_table]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1.5",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-1.5",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </article>
  );
}

/** SSE 를 직접 읽는다. EventSource 는 POST 를 못 보내고, 파일은 POST 로만 간다. */
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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.trim();
      if (line.startsWith("data: ")) onEvent(JSON.parse(line.slice(6)) as T);
    }
  }
}
