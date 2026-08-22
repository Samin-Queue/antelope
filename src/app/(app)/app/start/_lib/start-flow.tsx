"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import type { ComposerSubmit } from "@/components/app/composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { LiveScreen } from "@/app/(labs)/lab/notice/_lib/run-view";

import { AgentCard, emptyCards, type Cards } from "./agent-grid";
import { AskDialog, type AskItem } from "./ask-dialog";
import { useCallMe } from "./call-me";
import { NeedsForm, summarizeNeeds } from "./needs-form";
import { RunStatus } from "./run-status";
import { SteerBox } from "./steer-box";
import {
  APPLY_URL_KEY,
  CARD_OF,
  PLAN_OWNER_LABEL,
  STAGE_LABEL,
  type AgentKey,
  type ApplyEvent,
  type Artifact,
  type CardKey,
  type FileInfo,
  type Need,
  type Plan,
  type Stage,
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

/**
 * 워크벤치가 받는 것.
 *
 * 새 입력이거나, **죽은 실행을 이어받는 것**이거나 둘 중 하나다. 후자는
 * 서버가 스냅샷에서 끝난 단계를 건너뛰고 안 끝난 것부터 다시 돈다.
 */
export type StartInput = ComposerSubmit | { kind: "resume"; goalId: string };

export function StartFlow({ initial }: { initial: StartInput }) {
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
   * 폼은 Drawer 안에 있어서 닫히면 언마운트된다. 값이 폼 안에 있었을 때는
   * 제출 실패·Esc·바깥 클릭 어느 쪽이든 입력이 통째로 사라지고, 다시 열면
   * 선채움된 값만 남았다. 여기 두면 드로어가 몇 번 닫혀도 살아 있다.
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
  /**
   * 오른쪽에 펼쳐 놓을 산출물.
   *
   * 기본값은 진행을 따라간다 — 방금 만들어진 것이 저절로 보여야 「지금 뭘 하는지」가
   * 읽힌다. 사용자가 한 번 고르면 거기 고정한다(`pinned`). 읽고 있는 걸 화면이
   * 마음대로 넘겨 버리면 그게 더 나쁘다.
   */
  const [panel, setPanel] = useState<CardKey>("analyze");
  const pinned = useRef(false);
  /** 서버가 말해 준 것만 켠다 — 단계 사이 공백이 여기서 메워진다 */
  const [orchestrating, setOrchestrating] = useState(false);
  /**
   * 서버가 흘리는 진단.
   *
   * 서버는 모든 `ctx.log` 를 `log` 이벤트로 보내는데 화면이 그걸 통째로 버리고
   * 있었다. 「유효성 검사 실패 — Solar 로 대체」처럼 **결과를 가르는 결정**이
   * 서버 콘솔에만 남고, 사용자는 왜 그렇게 됐는지 알 방법이 없었다.
   */
  const [diagnostics, setDiagnostics] = useState<
    Array<{ stage?: Stage; text: string; ms?: number }>
  >([]);
  /**
   * 서술자가 지금까지 한 말. 준비와 신청이 요청 두 개로 갈려 있어서 클라이언트가
   * 들고 있다가 신청 요청에 실어 보낸다 — 그래야 맥락이 이어진다.
   */
  const narration = useRef<{ card: CardKey; headline: string; body: string }[]>([]);
  const pick = useCallback((card: CardKey) => {
    pinned.current = true;
    setPanel(card);
  }, []);
  const follow = useCallback((card: CardKey) => {
    if (!pinned.current) setPanel(card);
  }, []);
  const startedRef = useRef(false);
  /**
   * 서버가 스스로 끝냈다는 신호(`end`·`error`)를 받았는가.
   *
   * 이게 없이 스트림이 닫혔다면 중간에 잘린 것이다. 두 경우를 화면에서
   * 구분하지 못해서 「연결이 끊겨 중단됐다」 하나가 서버의 정상 종료까지
   * 덮고 있었다.
   */
  const terminal = useRef(false);
  /**
   * 그 종료가 **성공**이었는가.
   *
   * `terminal` 만으로는 부족하다. 서버가 제대로 끝냈는데도 `finally` 가 남은
   * 카드를 전부 error 로 덮어, 실제로 접수까지 마친 신청이 빨간 「연결이 끊겨
   * 중단됐다」로 끝나고 있었다. 사용자는 그걸 실패로 읽고 다시 시도한다 —
   * 이미 자기 이름으로 접수된 것을.
   */
  const terminalOk = useRef(false);
  /** 신청 스트림도 같다. `done`·`error` 를 받았는지 */
  const applyTerminal = useRef(false);
  const applyTerminalOk = useRef(false);

  /**
   * 사람이 필요한 순간에 **부른다.**
   *
   * 캡챠(`need:human`)와 값 질문(`ask`) 둘 다다. 지금까지는 화면을 지키고
   * 있어야 알았고, 안 보고 있으면 에이전트가 10~15분을 기다리다 그냥 끝났다.
   */
  useCallMe(
    apply.needHuman ?? (ask ? `「${ask.label}」 값이 필요합니다` : null),
    prepared?.title ?? "Antelope",
  );

  /** 카드 하나를 고친다. 여러 단계가 한 카드로 모이므로 단계→카드로 옮긴다 */
  const patch = useCallback(
    (card: CardKey, next: Partial<Cards[CardKey]>) =>
      setCards((prev) => ({ ...prev, [card]: { ...prev[card], ...next } })),
    [],
  );

  const patchStage = useCallback(
    (agent: AgentKey, next: Partial<Cards[CardKey]>) => patch(CARD_OF[agent], next),
    [patch],
  );

  /**
   * 스트림이 끝났는데 아직 도는 카드가 있으면 내린다.
   *
   * **스피너가 스트림보다 오래 살면 안 된다.** 스트림은 여러 이유로 끝난다 —
   * 서버 예외, `maxDuration` 초과로 플랫폼이 끊는 것, 네트워크 끊김. 어느
   * 쪽이든 지금까지는 화면이 똑같이 「도는 중」으로 남았고, 사용자는 멈춘 것과
   * 도는 것을 구분할 수 없었다. 정상 종료였다면 도는 카드가 없으므로 이 루프는
   * 아무것도 안 한다.
   */
  const settleCards = useCallback((why: string, status: "done" | "error" = "error") => {
    setOrchestrating(false);
    setCards((prev) => {
      const next = { ...prev };
      let touched = false;
      for (const key of Object.keys(next) as CardKey[]) {
        if (next[key].status === "running") {
          next[key] = { ...next[key], status, headline: why };
          touched = true;
        }
      }
      return touched ? next : prev;
    });
  }, []);

  /** 스트림이 어떻게 끝났는지에 맞춰 남은 카드를 내린다 */
  const settleByOutcome = useCallback(
    (ended: boolean, ok: boolean) => {
      if (!ended) settleCards("연결이 끊겨 중단됐다");
      else if (ok) settleCards("완료", "done");
      else settleCards("여기서 멈췄다");
    },
    [settleCards],
  );

  // 준비 — 컴포저 입력으로 한 번만 시작한다.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const body = new FormData();
    if (initial.kind === "file") body.append("file", initial.file);
    if (initial.kind === "url") body.append("url", initial.url);
    if (initial.kind === "text") body.append("text", initial.text);
    if (initial.kind === "resume") body.append("resume", initial.goalId);

    void readStream<StartEvent>("/app/start/run", body, (event) => {
      switch (event.type) {
        case "stage":
          patchStage(event.stage, {
            status: event.status === "start" ? "running" : event.status,
          });
          if (event.status !== "start") {
            setDiagnostics((prev) => [
              ...prev,
              {
                stage: event.stage,
                text: `${STAGE_LABEL[event.stage].title} ${event.status}${event.detail ? ` — ${event.detail}` : ""}`,
                ms: event.ms,
              },
            ]);
          }
          break;
        case "log":
          setDiagnostics((prev) => [...prev, { stage: event.stage, text: event.text }]);
          break;
        case "orchestrator":
          setOrchestrating(event.status === "start");
          break;
        case "card":
          // 오케스트레이터가 쓴 문장. 카드의 본문이 된다.
          patch(event.card, { headline: event.headline, body: event.body });
          narration.current.push({
            card: event.card,
            headline: event.headline,
            body: event.body,
          });
          follow(event.card);
          break;
        case "files":
          setFiles(event.files);
          patch("gather", { action: `모아 온 자료 ${event.files.length}개` });
          break;
        case "summary":
          setSummary({ markdown: event.markdown, via: event.via });
          break;
        case "brief":
          setBrief(event.markdown);
          patch("analyze", { action: "분석 자료 보기" });
          break;
        case "via":
          break;
        case "verdict":
          break;
        case "plan":
          setPlan(event.plan);
          patch("plan", { action: "계획서 보기" });
          break;
        case "artifacts":
          setArtifacts(event.artifacts);
          patch("file", { action: `작성한 서류 ${event.artifacts.length}개` });
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
          patch("data", { action: "입력 항목 보기" });
          break;
        }
        case "end":
          terminal.current = true;
          terminalOk.current = event.reason === "ready";
          if (event.reason === "stopped") setError(event.detail ?? "준비를 멈췄습니다.");
          break;
        case "error":
          terminal.current = true;
          setError(event.error);
          break;
      }
    })
      .then((info) => {
        // 서버는 어떤 경로로 끝나든 `end` 나 `error` 를 보낸다. 그게 없었다면
        // 스트림이 중간에 잘린 것이다 — 침묵 길이가 그걸 갈라 준다. 하트비트가
        // 15초마다 오므로 그보다 한참 길면 연결이 죽은 쪽이다.
        if (terminal.current) return;
        const cut = `서버가 종료 이벤트 없이 연결을 닫았다 — 마지막 수신 후 ${Math.round(info.silentMs / 1000)}초, 받은 이벤트 ${info.events}개`;
        setError((prev) => prev ?? cut);
        settleCards(cut);
      })
      .catch((cause) => {
        const text = cause instanceof Error ? cause.message : String(cause);
        setError(text);
        settleCards(`스트림 예외 — ${text}`);
      })
      .finally(() => {
        setPreparing(false);
        settleByOutcome(terminal.current, terminalOk.current);
      });
  }, [initial, patch, patchStage, follow, settleCards, settleByOutcome]);

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
      // 준비가 끝나는 순간 한 번만 여는 일회성 전환이다. 렌더에서 유도할 수 있는
      // 값이 아니고(사용자가 닫을 수 있다), `autoRef` 가 반복을 막는다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

    // 재시도할 수 있으므로 매번 초기화한다.
    applyTerminal.current = false;
    applyTerminalOk.current = false;
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
      const info = await readStream<ApplyEvent>(
        "/app/start/apply",
        JSON.stringify({
          applyUrl,
          title: target.title,
          facts,
          runId,
          // 서버가 신청 결과를 이 세션에 남긴다. 없으면 기록만 건너뛴다.
          sessionId,
          needs: filled,
          brief,
          narration: narration.current.slice(-12),
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
          // 경로는 보내지 않는다 — 서버가 이번 실행의 디렉터리 안에서 되짚는다.
          artifacts: artifacts.map((item) => ({
            label: item.label,
            filename: item.filename,
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
              patchStage(event.agent, {
                status: event.status === "start" ? "running" : event.status,
              });
              break;
            case "orchestrator":
              setOrchestrating(event.status === "start");
              break;
            case "card":
              patch(event.card, { headline: event.headline, body: event.body });
              follow(event.card);
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
              // 서술이 아직 안 왔을 때도 무엇을 하는지는 보여야 한다.
              patch("browser", { headline: `${label} ${event.detail}`.slice(0, 40) });
              break;
            }
            case "need:human":
              setApply((prev) => ({ ...prev, needHuman: event.reason }));
              break;
            case "human:done":
              setApply((prev) => ({ ...prev, needHuman: null }));
              break;
            case "done":
              applyTerminal.current = true;
              applyTerminalOk.current = true;
              setApply((prev) => ({ ...prev, status: "done", summary: event.summary }));
              break;
            case "error":
              applyTerminal.current = true;
              setApply((prev) => ({ ...prev, status: "error", error: event.error }));
              break;
          }
        },
        { "Content-Type": "application/json" },
      );
      // `done` 도 `error` 도 없이 끝났다 — 스트림이 중간에 잘렸다는 뜻이다.
      // 무엇이 잘랐는지는 침묵 길이가 말해 준다(하트비트가 15초마다 온다).
      if (!applyTerminal.current) {
        const cut = `서버가 종료 이벤트 없이 연결을 닫았다 — 마지막 수신 후 ${Math.round(info.silentMs / 1000)}초, 받은 이벤트 ${info.events}개`;
        setApply((prev) => ({ ...prev, status: "error", error: cut }));
        settleCards(cut);
      }
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      setApply((prev) => ({ ...prev, status: "error", error: `스트림 예외 — ${text}` }));
      settleCards(`스트림 예외 — ${text}`);
    } finally {
      // 서버가 `done`·`error` 로 끝냈으면 여기서 덮지 않는다. 덮으면 접수까지
      // 마친 신청이 「연결이 끊겨 중단됐다」로 끝난다 — 화면이 서버와 정반대를
      // 말하고, 사용자는 이미 접수된 것을 다시 낸다.
      if (!applyTerminal.current) {
        setApply((prev) =>
          prev.status === "running"
            ? { ...prev, status: "error", error: "연결이 끊겨 신청이 중단됐다." }
            : prev,
        );
      }
      settleByOutcome(applyTerminal.current, applyTerminalOk.current);
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
    patch("browser", { headline: `지시 전달: ${text}`.slice(0, 40) });
    void fetch("/app/start/steer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "steer", runId, text, mode }),
    }).catch(() => {});
  };

  return (
    /**
     * 화면을 **꽉 채운다.**
     *
     * 예전에는 산출물이 오른쪽 26rem 고정이고 `xl` 아래에서는 아예 숨었다.
     * 넓은 화면에서는 카드 두 장이 터무니없이 넓어지고, 정작 읽을 것(요약·
     * 계획·서류)은 좁은 띠에 갇히거나 사라졌다. 주영역을 **반으로 가른다** —
     * 왼쪽이 에이전트, 오른쪽이 결과물이다.
     *
     * 바깥에 패딩을 두지 않는다. 두 판이 각자 스크롤하고 가운데 선으로만
     * 갈리는 편이, 전체가 한 번에 스크롤되며 여백을 흘리는 것보다 낫다.
     */
    <div className="flex h-full min-h-0 items-stretch">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 py-6 lg:w-1/2 lg:flex-none">
        <div className="flex min-h-0 flex-1 flex-col space-y-4">
          <header className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-medium">
              {prepared?.title ?? "공고를 읽는 중"}
            </h1>
            {prepared?.organization && (
              <span className="text-sm text-muted-foreground">
                {prepared.organization}
              </span>
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
          </header>

          <RunStatus
            cards={cards}
            orchestrating={orchestrating}
            preparing={preparing}
            applying={apply.status === "running"}
          />

          {/* 준비 여섯 칸은 2열, 실행은 그 아래 전폭. 실행 카드는 라이브 화면을
            옆에 달아 「무엇을 조작하고 있는지」가 카드 안에서 읽힌다.
            주영역이 반쪽이 됐으므로 2열은 `md` 부터다 — `sm` 에서 두 줄로
            나누면 카드 하나에 두 단어씩만 들어간다. */}
          <div className="grid gap-3 md:grid-cols-2">
            {(["goal", "gather", "analyze", "plan", "data", "file"] as const).map(
              (key) => (
                <AgentCard
                  key={key}
                  card={key}
                  state={cards[key]}
                  onOpen={() => pick(key)}
                />
              ),
            )}
          </div>

          <AgentCard card="browser" state={cards.browser} onOpen={() => pick("browser")}>
            {(apply.frame || apply.status === "running") && (
              <div className="hidden w-72 shrink-0 sm:block">
                <LiveScreen
                  frame={apply.frame}
                  running={apply.status === "running"}
                  sessionId={apply.sessionId}
                  needHuman={apply.needHuman}
                  onHumanDone={() => setApply((prev) => ({ ...prev, needHuman: null }))}
                />
              </div>
            )}
          </AgentCard>

          <SteerBox disabled={!runId || apply.status !== "running"} onSend={steer} />

          {(apply.error || error) && (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 font-mono text-xs break-words text-destructive">
              {apply.error ?? error}
            </p>
          )}

          <Diagnostics lines={diagnostics} />

          {/* 실패한 뒤에도 폼으로 돌아갈 수 있어야 한다. `idle` 만 허용했을 때는
            신청이 한 번 깨지면 에러 문구만 남고 되돌아갈 길이 없었다. */}
          {prepared &&
            !needsOpen &&
            (apply.status === "idle" || apply.status === "error") && (
              <Button onClick={() => setNeedsOpen(true)}>
                {apply.status === "error"
                  ? "입력 고치고 다시 신청"
                  : "입력 확인하고 신청"}
              </Button>
            )}

          {/* 다이얼로그가 아니라 드로어다. 물어볼 항목이 스무 개를 넘길 때가 있어
            가운데 뜨는 상자로는 스크롤 안에 제출 버튼이 파묻힌다. 아래에서
            올라오는 판에 머리말·본문·푸터를 갈라 두면 「이 정보로 신청 진행」이
            스크롤과 무관하게 늘 같은 자리에 있다. */}
          <Drawer open={needsOpen} onOpenChange={setNeedsOpen} showSwipeHandle>
            <DrawerContent className="mx-auto sm:max-w-3xl">
              <DrawerHeader>
                <DrawerTitle>신청에 필요한 정보</DrawerTitle>
                <DrawerDescription>{prepared?.title}</DrawerDescription>
              </DrawerHeader>
              {prepared && (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
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
                    />
                  </div>
                  <NeedsFooter
                    needs={prepared.needs}
                    values={values}
                    onSubmit={() => void startApply(prepared, values)}
                  />
                </>
              )}
            </DrawerContent>
          </Drawer>

          <AskDialog item={ask} onAnswer={answer} />
        </div>
      </div>

      {/* 산출물은 오른쪽 절반이다. 아래에 접어 두면 스크롤해야 보이고,
          그러면 격자에서 눈을 떼야 한다 — 진행과 결과는 같이 봐야 한다. */}
      <OutputPanel
        panel={panel}
        onPick={pick}
        summary={summary}
        brief={brief}
        plan={plan}
        files={files}
        artifacts={artifacts}
        needs={prepared?.needs ?? []}
        result={apply.summary}
      />
    </div>
  );
}

/**
 * 서버 진단 — 접어 둔다.
 *
 * 서버는 단계마다 무엇을 왜 그렇게 했는지 `log` 로 흘리고 있었는데 화면이
 * 그것을 통째로 버렸다. 「유효성 검사 실패 — Solar 로 대체」·「지식베이스에서
 * 3개 채움」 같은 결정이 서버 콘솔에만 남아, 사용자도 우리도 왜 그 결과가
 * 나왔는지 알 수 없었다. 기본은 접힌 상태다 — 평소엔 볼 것이 아니고, 무언가
 * 이상할 때 **그 자리에서** 열려야 하는 것이다.
 */
function Diagnostics({
  lines,
}: {
  lines: Array<{ stage?: Stage; text: string; ms?: number }>;
}) {
  if (lines.length === 0) return null;
  const total = lines.reduce((sum, line) => sum + (line.ms ?? 0), 0);
  return (
    <details className="rounded-lg border border-border/60 bg-muted/30">
      <summary className="cursor-pointer px-4 py-2 text-xs text-muted-foreground select-none">
        서버 진단 {lines.length}줄
        {total > 0 ? ` · 단계 합계 ${(total / 1000).toFixed(1)}초` : ""}
      </summary>
      <ul className="max-h-64 space-y-0.5 overflow-y-auto px-4 pt-1 pb-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {lines.map((line, index) => (
          <li key={index} className="break-words">
            {line.stage && (
              <span className="text-brand">{STAGE_LABEL[line.stage].title} </span>
            )}
            {line.text}
            {line.ms !== undefined && (
              <span className="tabular-nums"> · {(line.ms / 1000).toFixed(1)}초</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * 드로어 푸터 — 스크롤 밖에 고정된다.
 *
 * 항목이 많으면 제출 버튼이 본문 맨 아래로 밀려 스크롤해야 보인다. 무엇이
 * 모자라서 못 누르는지도 버튼 옆에 같이 붙여 둔다 — 비활성 버튼만 있으면
 * 사용자는 이유를 찾아 다시 위로 올라가야 한다.
 */
function NeedsFooter({
  needs,
  values,
  onSubmit,
}: {
  needs: Need[];
  values: Record<string, string>;
  onSubmit: () => void;
}) {
  const { missingRequired } = summarizeNeeds(needs, values);
  return (
    <DrawerFooter className="flex-row items-center gap-3 border-t border-border pt-4">
      <Button onClick={onSubmit} disabled={missingRequired > 0}>
        이 정보로 신청 진행
      </Button>
      <span className="text-xs text-muted-foreground">
        {missingRequired > 0 ? `필수 ${missingRequired}개 미입력` : "필수 항목 완료"}
      </span>
    </DrawerFooter>
  );
}

/**
 * 산출물 패널.
 *
 * 카드가 「무엇을 했는지」를 말하면 여기가 「무엇을 만들었는지」를 보여준다.
 * 아래 접이식으로 두면 스크롤해야 보이고 그러면 진행 격자에서 눈을 떼야 한다.
 */
const PANEL_TITLE: Record<CardKey, string> = {
  goal: "입력한 것",
  gather: "모아 온 자료",
  analyze: "공고 분석",
  plan: "지원 계획",
  data: "수집 정보",
  file: "작성한 서류",
  browser: "결과",
};

function OutputPanel({
  panel,
  onPick,
  summary,
  brief,
  plan,
  files,
  artifacts,
  needs,
  result,
}: {
  panel: CardKey;
  onPick: (card: CardKey) => void;
  summary: { markdown: string; via: string } | null;
  brief: string | null;
  plan: Plan | null;
  files: FileInfo[];
  artifacts: Artifact[];
  needs: Need[];
  result: string | null;
}) {
  return (
    <aside className="hidden min-w-0 flex-col border-l border-border/60 lg:flex lg:w-1/2">
      <nav className="flex flex-wrap gap-1 border-b border-border/60 px-4 py-3">
        {(Object.keys(PANEL_TITLE) as CardKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              panel === key
                ? "bg-brand/15 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PANEL_TITLE[key]}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {panel === "analyze" &&
          (brief || summary ? (
            <Prose markdown={brief ?? summary?.markdown ?? ""} />
          ) : (
            <Empty />
          ))}

        {panel === "plan" &&
          (plan?.steps.length ? (
            <ol className="space-y-2">
              {plan.steps.map((step, index) => (
                <li key={step.id} className="rounded-lg bg-muted/40 px-3 py-2.5">
                  <div className="flex items-start gap-2">
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
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge variant={step.owner === "user" ? "default" : "outline"}>
                      {PLAN_OWNER_LABEL[step.owner]}
                    </Badge>
                    {step.dueDate && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {step.dueDate}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty />
          ))}

        {panel === "data" &&
          (needs.length ? (
            <ul className="space-y-1.5">
              {needs.map((need) => (
                <li key={need.key} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{need.label}</span>
                    {need.required && <span className="text-xs text-brand">필수</span>}
                    <span
                      className={cn(
                        "ml-auto truncate text-xs",
                        need.value?.trim() ? "" : "text-muted-foreground",
                      )}
                    >
                      {need.value?.trim() || "비어 있음"}
                    </span>
                  </div>
                  {need.from === "memory" && (
                    <p className="mt-0.5 text-[11px] text-brand">
                      지식베이스{need.memoryLabel ? ` · ${need.memoryLabel}` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          ))}

        {panel === "file" &&
          (artifacts.length ? (
            <ul className="space-y-1.5">
              {artifacts.map((item) => (
                <li
                  key={item.needKey}
                  className="rounded-lg bg-muted/40 px-3 py-2 text-sm"
                >
                  <p className="truncate">{item.filename}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {item.label}
                    <span className="ml-auto font-mono">
                      {(item.bytes / 1024).toFixed(0)}KB
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          ))}

        {panel === "gather" &&
          (files.length ? (
            <ul className="space-y-1.5">
              {files.map((file) => (
                <li
                  key={`${file.origin}-${file.name}`}
                  className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                >
                  <span className="truncate">{file.name}</span>
                  <Badge variant="outline">{file.origin}</Badge>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {(file.bytes / 1024).toFixed(0)}KB
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          ))}

        {panel === "goal" &&
          (summary ? <Prose markdown={summary.markdown} /> : <Empty />)}

        {panel === "browser" &&
          (result ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {result}
            </p>
          ) : (
            <Empty text="결과를 기다리고 있습니다" />
          ))}
      </div>
    </aside>
  );
}

function Empty({ text = "아직 없습니다" }: { text?: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>;
}

function Prose({ markdown }: { markdown: string }) {
  return (
    <article
      className={cn(
        // 판이 반폭이 되면서 넓은 화면에서는 1,000px 이 넘는다. 한 줄이 그만큼
        // 길면 다음 줄 첫 글자를 못 찾는다 — 글줄만 잡고 표는 판을 다 쓴다.
        "max-w-[78ch] text-sm leading-6 break-words",
        "[&_a]:text-brand [&_a]:underline [&_h1]:mb-3 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_li]:pl-1",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5",
        "[&_table]:my-2 [&_table]:w-full [&_table]:max-w-none [&_td]:border [&_td]:border-border [&_td]:p-1.5",
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
  // 스트림이 어떻게 끝났는지 말해 주기 위한 것. 서버가 15초마다 하트비트를
  // 흘리므로, 침묵이 그보다 한참 길면 연결이 죽은 쪽이다.
  let last = Date.now();
  let events = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    last = Date.now();
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.trim();
      if (line.startsWith("data: ")) {
        events += 1;
        onEvent(JSON.parse(line.slice(6)) as T);
      }
    }
  }
  return { silentMs: Date.now() - last, events };
}
