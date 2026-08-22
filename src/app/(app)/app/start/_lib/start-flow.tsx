"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp, CircleCheck, Link2, Loader2, MonitorPlay } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import type { ComposerSubmit } from "@/components/app/composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveScreen } from "@/app/(labs)/lab/notice/_lib/run-view";

import { AgentCard, emptyCards, type Cards, type CardState } from "./agent-grid";
import { AskDialog, type AskItem } from "./ask-dialog";
import { useCallMe } from "./call-me";
import { DocumentRow, Field, summarizeNeeds } from "./needs-form";
import { RunStatus } from "./run-status";
import { SteerBox } from "./steer-box";
import {
  APPLY_URL_KEY,
  CARD_LABEL,
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
  type SessionSnapshot,
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
export type StartInput =
  | ComposerSubmit
  | { kind: "resume"; goalId: string }
  /**
   * 저장된 세션을 **그대로 다시 그린다.**
   *
   * 지난 세션이 라이브와 다른 화면이면, 새로고침 한 번에 사용자는 자기가 보던
   * 것을 잃는다 — 카드도 산출물 탭도 신청 버튼도 없는 문서 한 장이 남았다.
   * 스트림만 안 열 뿐 화면은 같은 것을 쓴다.
   */
  | { kind: "replay"; goalId: string; snapshot: SessionSnapshot };

/**
 * 스냅샷을 카드 상태로 되돌린다.
 *
 * 단계와 카드는 1:1 이 아니다(`CARD_OF`) — 여러 단계가 한 칸에 모이므로
 * **가장 나쁜 상태**를 남긴다. 실패한 단계가 하나라도 있으면 그 칸은 실패다.
 */
function cardsFrom(snapshot: SessionSnapshot): Cards {
  const cards = emptyCards();
  const rank: Record<CardState["status"], number> = {
    idle: 0,
    skip: 1,
    done: 2,
    running: 3,
    error: 4,
  };
  for (const [stage, state] of Object.entries(snapshot.stages ?? {}) as Array<
    [Stage, CardState["status"] | undefined]
  >) {
    const card = CARD_OF[stage];
    if (!card || !state) continue;
    if (rank[state] >= rank[cards[card].status]) cards[card] = { status: state };
  }
  for (const turn of snapshot.narration ?? []) {
    cards[turn.card] = {
      ...cards[turn.card],
      headline: turn.headline,
      body: turn.body,
    };
  }
  if (snapshot.summary) cards.analyze.via = snapshot.summary.via;
  if (snapshot.needs.length) cards.data.action = "입력 항목 보기";
  if (snapshot.plan?.steps.length) cards.plan.action = "계획서 보기";
  if (snapshot.artifacts.length) cards.file.action = "작성한 서류 보기";
  return cards;
}

export function StartFlow({ initial }: { initial: StartInput }) {
  /** 저장된 세션을 다시 그리는 중인가. 이때는 스트림을 열지 않는다 */
  const saved = initial.kind === "replay" ? initial.snapshot : null;

  const [cards, setCards] = useState<Cards>(() =>
    saved ? cardsFrom(saved) : emptyCards(),
  );
  const [files, setFiles] = useState<FileInfo[]>(saved?.files ?? []);
  const [summary, setSummary] = useState<{ markdown: string; via: string } | null>(
    saved?.summary ?? null,
  );
  const [brief, setBrief] = useState<string | null>(saved?.brief ?? null);
  const [plan, setPlan] = useState<Plan | null>(saved?.plan ?? null);
  const [artifacts, setArtifacts] = useState<Artifact[]>(saved?.artifacts ?? []);
  /**
   * 이 실행이 파일을 담는 폴더 id.
   *
   * 재생일 때는 저장된 것을 쓰고, 없으면(이 필드가 생기기 전에 저장된 세션)
   * 새로 만든다 — 없으면 서류 업로드도 신청도 못 한다. 폴더가 비어 있어도
   * 새로 올리면 그만이다.
   */
  const [runId, setRunId] = useState<string | null>(() =>
    saved ? (saved.runId ?? crypto.randomUUID()) : null,
  );
  const [prepared, setPrepared] = useState<Prepared | null>(
    saved
      ? {
          title: saved.title,
          organization: saved.organization,
          deadline: saved.deadline,
          applyUrl: saved.applyUrl,
          needs: saved.needs,
        }
      : null,
  );
  /**
   * 사용자가 입력한 값. 폼이 아니라 여기에 둔다.
   *
   * 폼은 Drawer 안에 있어서 닫히면 언마운트된다. 값이 폼 안에 있었을 때는
   * 제출 실패·Esc·바깥 클릭 어느 쪽이든 입력이 통째로 사라지고, 다시 열면
   * 선채움된 값만 남았다. 여기 두면 드로어가 몇 번 닫혀도 살아 있다.
   */
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (saved?.needs ?? [])
        .filter((need: Need) => need.value)
        .map((need: Need) => [need.key, need.value ?? ""]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(!saved);
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
  const [sessionId, setSessionId] = useState<string | null>(
    initial.kind === "replay" ? initial.goalId : null,
  );
  /**
   * 오른쪽에 펼쳐 놓을 산출물.
   *
   * 기본값은 진행을 따라간다 — 방금 만들어진 것이 저절로 보여야 「지금 뭘 하는지」가
   * 읽힌다. 사용자가 한 번 고르면 거기 고정한다(`pinned`). 읽고 있는 걸 화면이
   * 마음대로 넘겨 버리면 그게 더 나쁘다.
   */
  const [panel, setPanel] = useState<CardKey>("analyze");
  const pinned = useRef(false);
  /**
   * 푸터의 브라우저 화면을 펼쳤는가.
   *
   * 신청이 시작되면 저절로 펼친다 — 실제 조작이 시작됐는데 접혀 있으면 이
   * 제품이 무엇을 하는지 보여 줄 자리가 화면에서 사라진다. 사용자가 한 번
   * 손대면(`screenPinned`) 그 뒤로는 마음대로 여닫지 않는다.
   */
  const [screenOpen, setScreenOpen] = useState(false);
  const screenPinned = useRef(false);
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
  const narration = useRef<{ card: CardKey; headline: string; body: string }[]>(
    saved?.narration ? [...saved.narration] : [],
  );
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

  /**
   * 준비를 돈다. 처음 한 번과, 실패 뒤 사용자가 내용을 보태 다시 거는 경우.
   *
   * `more` 는 사용자가 뒤늦게 보탠 글이다. 원래 입력을 **다시 실어** 보낸다 —
   * 「공고로 읽을 내용이 부족하다」로 멈춘 실행은 저장된 요약이 이미 bad 라
   * `resume` 으로 이어받아 봐야 같은 판정에서 또 멈춘다. 처음부터 다시 돌되
   * 모자랐던 내용을 채워 주는 것이 유일하게 통하는 길이다.
   */
  const startRun = useCallback(
    (more?: string) => {
      if (initial.kind === "replay") return;

      // 다시 도는 것이므로 지난 실행의 흔적을 지운다. 안 지우면 실패한 카드가
      // 그대로 남아, 새 실행이 그 자리를 다시 켤 때까지 「실패」로 보인다.
      terminal.current = false;
      terminalOk.current = false;
      setError(null);
      setDiagnostics([]);
      setCards(emptyCards());
      setPreparing(true);

      /**
       * ⚠ 같은 키를 두 번 `append` 하면 안 된다. 서버는 `form.get("text")` 로
       * **첫 값만** 읽어서, 보탠 글이 조용히 버려진다. 합쳐서 한 번만 넣는다.
       */
      const extra = more?.trim() ?? "";
      // 링크 한 줄이면 링크로 보낸다 — 서버가 그때만 페이지를 가져온다.
      const extraIsUrl = /^https?:\/\/\S+$/.test(extra);
      const texts = [
        initial.kind === "text" ? initial.text : "",
        extraIsUrl ? "" : extra,
      ].filter(Boolean);

      const body = new FormData();
      if (initial.kind === "file") body.append("file", initial.file);
      if (initial.kind === "resume") body.append("resume", initial.goalId);
      // 원래 입력이 링크였고 보탠 것도 링크면 **보탠 쪽**을 쓴다. 앞의 링크는
      // 방금 못 읽은 그것이라 다시 걸어 봐야 같은 자리에서 또 막힌다.
      const url = extraIsUrl ? extra : initial.kind === "url" ? initial.url : "";
      if (url) body.append("url", url);
      if (texts.length) body.append("text", texts.join("\n\n"));

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
          case "card": {
            // 오케스트레이터가 쓴 문장. 카드의 본문이 된다.
            patch(event.card, { headline: event.headline, body: event.body });
            // 서버가 같은 칸을 두 번 보낸다 — 코드가 아는 한 줄을 먼저 박고,
            // 서술이 오면 덮어쓴다. 맥락에는 나중 것만 남겨야 서술자가 자기가
            // 쓴 적 없는 문장을 「지금까지 한 말」로 돌려받지 않는다.
            const turn = {
              card: event.card,
              headline: event.headline,
              body: event.body,
            };
            const last = narration.current.at(-1);
            if (last?.card === event.card)
              narration.current[narration.current.length - 1] = turn;
            else narration.current.push(turn);
            follow(event.card);
            break;
          }
          case "files":
            setFiles(event.files);
            // 0건이면 버튼을 안 단다. 눌러 봐야 빈 판이고, 「0개」라는 사실은
            // 카드 문장이 이미 말한다.
            patch("gather", {
              action: event.files.length
                ? `모아 온 자료 ${event.files.length}개`
                : undefined,
            });
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
            if (event.reason === "stopped")
              setError(event.detail ?? "준비를 멈췄습니다.");
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
    },
    [initial, patch, patchStage, follow, settleCards, settleByOutcome],
  );

  // 준비 — 컴포저 입력으로 한 번만 시작한다. 두 번째부터는 사용자가 건다.
  useEffect(() => {
    if (initial.kind === "replay") return;
    if (startedRef.current) return;
    startedRef.current = true;
    startRun();
  }, [initial, startRun]);

  useEffect(() => {
    if (apply.status === "running" && !screenPinned.current) setScreenOpen(true);
  }, [apply.status]);

  // 빈 항목이 없으면 사람을 거치지 않는다. 있으면 다이얼로그를 띄운다.
  const autoRef = useRef(false);
  useEffect(() => {
    /**
     * ⚠ **지난 세션을 열었을 때는 아무것도 시작하지 않는다.**
     *
     * 이 자동 신청은 「방금 준비를 마쳤다」는 맥락에서만 옳다. 저장된 세션은
     * `prepared` 가 처음부터 채워져 있으므로, 막지 않으면 목록에서 지난 세션을
     * **눌러 보기만 해도 신청서가 다시 제출된다.** 되돌릴 수 없는 일이다.
     */
    if (initial.kind === "replay") return;
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
      // 물어볼 것이 남았으면 그 탭으로 데려간다. 준비가 끝나는 순간 한 번만
      // 도는 일회성 전환이고, `autoRef` 가 반복을 막는다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      pick("data");
    }
    // startApply 는 매 렌더 새로 만들어진다. prepared 가 올 때 한 번만 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared, initial.kind]);

  async function startApply(target: Prepared, values: Record<string, string>) {
    const applyUrl = values[APPLY_URL_KEY]?.trim() || target.applyUrl;
    if (!applyUrl) {
      setApply((prev) => ({ ...prev, status: "error", error: "신청 URL 이 없습니다." }));
      return;
    }
    // 신청이 시작되면 결과가 보이는 자리로 옮긴다. 다 채운 입력 목록을 계속
    // 보여 줄 이유가 없다.
    pick("browser");

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

  /**
   * 도중에 끼어든다. 준비 중이면 파이프라인이(계획 단계에서), 신청 중이면
   * 브라우저 에이전트가 스텝 경계에서 꺼내 간다.
   *
   * **실패를 삼키지 않는다.** 끝난 실행에 넣으면 서버가 404 를 주는데, 그걸
   * 버리고 있어서 화면에는 「지시 전달」이 뜨고 에이전트는 아무것도 못 받았다 —
   * 전달된 줄 알고 기다리는 것이 안 눌리는 것보다 나쁘다.
   */
  /**
   * 아직 못 채운 필수 항목 수. 푸터 버튼과 탭이 같은 숫자를 쓴다 —
   * 두 곳이 각자 세면 「필수 0개」인데 버튼이 안 넘어가는 일이 생긴다.
   */
  const { missingRequired } = summarizeNeeds(prepared?.needs ?? [], values);

  const steer = (text: string, mode: "now" | "next") => {
    const card: CardKey = apply.status === "running" ? "browser" : "plan";
    patch(card, { headline: `지시 전달: ${text}`.slice(0, 40) });
    void fetch("/app/start/steer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "steer", runId, text, mode }),
    })
      .then((response) => {
        if (response.ok) return;
        setError(
          response.status === 404
            ? "이미 끝난 실행이라 지시를 전달하지 못했습니다."
            : `지시 전달 실패 — HTTP ${response.status}`,
        );
        patch(card, { headline: "지시 전달 실패" });
      })
      .catch((cause) => {
        setError(`지시 전달 실패 — ${cause instanceof Error ? cause.message : cause}`);
        patch(card, { headline: "지시 전달 실패" });
      });
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
    <div className="flex h-full min-h-0 w-full items-stretch overflow-hidden">
      {/*
        `lg:w-1/2` 만으로는 반이 안 된다. 두 칸 모두 `min-w-0` 로 min-content
        바닥을 끊어야 넘치는 내용이 칸을 밀지 않는다 — 없으면 긴 값 한 줄이
        오른쪽 판을 부풀려 뷰포트 밖으로 나간다.
      */}
      <div className="flex min-w-0 flex-1 flex-col lg:w-1/2 lg:flex-none">
        {/*
          스크롤은 **이 안쪽만** 진다. 지시 상자와 신청 버튼은 아래 푸터로
          빠져 나가 늘 같은 자리에 있다 — 카드 일곱 장이 화면을 넘기면서
          「입력 확인하고 신청」이 스크롤 밖으로 밀려 안 보였다.
        */}
        <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto px-6 py-6">
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

          {/*
            지금 무슨 일이 일어나는지 알리는 줄이다. 저장된 세션에는 일어나는
            일이 없다 — 「준비를 마쳤습니다」가 방금 끝난 것처럼 떠 있으면
            사용자가 지금 도는 실행으로 착각한다.
          */}
          {initial.kind !== "replay" && (
            <RunStatus
              cards={cards}
              orchestrating={orchestrating}
              preparing={preparing}
              applying={apply.status === "running"}
            />
          )}

          {/* 준비 여섯 칸은 2열. 일곱째(`browser`)는 여기 없다 — 푸터의
            손잡이 안으로 들어갔다. 주영역이 반쪽이 됐으므로 2열은 `md` 부터다:
            `sm` 에서 두 줄로 나누면 카드 하나에 두 단어씩만 들어간다. */}
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

          <Diagnostics lines={diagnostics} />

          <AskDialog item={ask} onAnswer={answer} />
        </div>

        {/*
          스크롤 밖에 고정한다. 여기 셋은 실행 중에 개입하는 유일한 통로이고,
          「입력 확인하고 신청」은 이 화면 전체의 목적지다 — 목록 끝에 놓으면
          사용자가 그것을 찾으러 스크롤해야 한다.
        */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-border/60 bg-background px-6 py-4">
          <BrowserDock
            state={cards.browser}
            apply={apply}
            open={screenOpen}
            onToggle={() => {
              screenPinned.current = true;
              setScreenOpen((prev) => !prev);
            }}
            onOpenPanel={() => pick("browser")}
            onHumanDone={() => setApply((prev) => ({ ...prev, needHuman: null }))}
          />

          {/* 준비 중에도 연다. 준비는 몇 분씩 걸리는데 그동안 상자가 죽어
              있으면, 사용자가 할 수 있는 일은 끝난 뒤 결과를 통째로 버리는
              것뿐이다. 준비 지시는 계획 단계가, 신청 지시는 브라우저
              에이전트가 스텝 경계에서 꺼내 간다.

              멈춘 뒤에는 `retry` 로 바뀐다 — 같은 자리에서 모자랐던 내용을
              보태 준비를 다시 건다. 실행 중인 것이 없고 준비도 못 끝냈다면
              그게 곧 「멈춘 상태」다. */}
          <SteerBox
            mode={
              runId && (preparing || apply.status === "running")
                ? "live"
                : initial.kind !== "replay" && !preparing && !prepared
                  ? "retry"
                  : "off"
            }
            onSend={steer}
            onRetry={startRun}
          />

          {(apply.error || error) && (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 font-mono text-xs break-words text-destructive">
              {apply.error ?? error}
            </p>
          )}

          {/*
            버튼 하나가 두 가지를 한다 — 못 채운 필수가 있으면 그 자리로
            **데려가고**, 다 채웠으면 신청한다. 채우지도 않았는데 신청 버튼이
            비활성으로 서 있으면, 사용자는 무엇이 모자란지 찾으러 다녀야 한다.

            실패한 뒤에도 눌린다. `idle` 만 허용했을 때는 신청이 한 번 깨지면
            에러 문구만 남고 되돌아갈 길이 없었다.
          */}
          {prepared && (apply.status === "idle" || apply.status === "error") && (
            <Button
              onClick={() => {
                if (missingRequired > 0) {
                  pick("data");
                  return;
                }
                void startApply(prepared, values);
              }}
            >
              {missingRequired > 0
                ? `필수 ${missingRequired}개 입력하기`
                : apply.status === "error"
                  ? "다시 신청"
                  : "이 정보로 신청 진행"}
            </Button>
          )}
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
        values={values}
        onChangeValue={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
        runId={runId}
        sourceNotice={prepared?.title ?? ""}
        onUpload={(artifact) =>
          setArtifacts((prev) => [
            ...prev.filter((item) => item.needKey !== artifact.needKey),
            artifact,
          ])
        }
        cards={cards}
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
 * 브라우저 도크 — 푸터에 붙어 있는 손잡이와 그 안의 실제 화면.
 *
 * 실행 카드는 격자 마지막 칸이었다. 준비가 길어지면 그 칸이 스크롤 아래로
 * 밀려, **이 제품이 실제로 하는 일**(사이트를 대신 조작하는 것)이 정작 그 일이
 * 벌어지는 동안 화면 밖에 있었다. 손잡이는 늘 같은 자리에 있고, 신청이
 * 시작되면 저절로 열린다.
 *
 * 시작 전에도 접힌 손잡이가 **자리를 예고한다.** 눌러 펼치면 빈 브라우저 틀이
 * 뜨고(`LiveScreen` 이 이미 그 상태를 그린다), 신청이 시작되면 같은 틀 안이
 * 실제 화면으로 바뀐다 — 새 것이 튀어나오는 대신 있던 것이 채워진다.
 */
function BrowserDock({
  state,
  apply,
  open,
  onToggle,
  onOpenPanel,
  onHumanDone,
}: {
  state: CardState;
  apply: ApplyState;
  open: boolean;
  onToggle: () => void;
  onOpenPanel: () => void;
  onHumanDone: () => void;
}) {
  const running = apply.status === "running";
  const status =
    state.headline ??
    (running
      ? "실행 중"
      : apply.status === "done"
        ? "완료"
        : apply.status === "error"
          ? "실패"
          : "대기");

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40",
          open && "border-b border-border",
        )}
      >
        <MonitorPlay
          className={cn(
            "size-4 shrink-0",
            running ? "text-brand" : "text-muted-foreground",
          )}
        />
        <span className="text-sm font-medium">{CARD_LABEL.browser}</span>
        {running && <Loader2 className="size-3.5 shrink-0 animate-spin text-brand" />}
        {apply.status === "done" && (
          <CircleCheck className="size-3.5 shrink-0 text-emerald-500" />
        )}
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {status}
        </span>
        {/* 사람을 기다리는 중이면 접혀 있어도 보여야 한다 — 접힌 손잡이 뒤에서
            기다리면 아무도 안 온다. */}
        {apply.needHuman && (
          <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
            사람 대기
          </span>
        )}
        <ChevronUp
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open ? "rotate-0" : "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="max-h-[52vh] space-y-3 overflow-y-auto bg-card/40 p-3">
          <LiveScreen
            frame={apply.frame}
            running={running}
            sessionId={apply.sessionId}
            needHuman={apply.needHuman}
            onHumanDone={onHumanDone}
          />

          {state.body && (
            <p className="text-sm leading-relaxed text-muted-foreground">{state.body}</p>
          )}

          {apply.steps.length > 0 && (
            <Button variant="outline" size="xs" onClick={onOpenPanel}>
              처리 결과 보기
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 산출물 패널.
 *
 * 카드가 「무엇을 했는지」를 말하면 여기가 「무엇을 만들었는지」를 보여준다.
 * 아래 접이식으로 두면 스크롤해야 보이고 그러면 진행 격자에서 눈을 떼야 한다.
 */
const PANEL_TITLE: Record<CardKey, string> = {
  goal: "요청사항 분석",
  gather: "추가 자료 수집",
  analyze: "공고 분석",
  plan: "진행 계획",
  data: "필요한 정보",
  file: "파일 생성",
  browser: "처리 결과",
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
  values,
  onChangeValue,
  runId,
  sourceNotice,
  onUpload,
  cards,
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
  /** 「필요한 정보」 탭이 읽기 전용이 아니라 입력 자리가 되면서 함께 온다 */
  values: Record<string, string>;
  onChangeValue: (key: string, value: string) => void;
  runId: string | null;
  sourceNotice: string;
  onUpload: (artifact: Artifact) => void;
  /** 빈 탭이 「왜」 비었는지 — 아직 안 돈 건지, 도는 중인지, 멈춘 건지 */
  cards: Cards;
}) {
  /**
   * 내용이 있는 탭만 누를 수 있다. 빈 탭을 눌러 「아직 없습니다」를 보는 것은
   * 아무것도 알려주지 않고, 어디까지 진행됐는지도 탭 자체가 말해 준다.
   * 지금 보고 있는 탭은 비어 있어도 잠그지 않는다 — 활성 탭이 회색으로 죽는다.
   */
  const filled: Record<CardKey, boolean> = {
    goal: Boolean(summary),
    gather: files.length > 0,
    analyze: Boolean(brief),
    plan: Boolean(plan?.steps.length),
    data: needs.length > 0,
    file: artifacts.length > 0,
    browser: Boolean(result),
  };

  return (
    <aside className="hidden min-w-0 shrink-0 flex-col border-l border-border/60 lg:flex lg:w-1/2">
      <Tabs
        value={panel}
        // 자동 폴백(`disabled`·`missing`)까지 받으면 사용자가 고른 적 없는 탭에
        // 화면이 고정된다. 사람이 누른 것(`none`)만 넘긴다.
        onValueChange={(value, details) => {
          if (details.reason === "none") onPick(value as CardKey);
        }}
        className="border-b border-border/60 px-4 py-3"
      >
        <TabsList
          variant="line"
          // 탭이 7개라 반폭에서 두 줄로 접힌다. 리스트 높이를 풀어 주지 않으면
          // 접힌 줄이 8px 높이 안에서 겹친다.
          className="w-full flex-wrap justify-start gap-3 group-data-horizontal/tabs:h-auto"
        >
          {(Object.keys(PANEL_TITLE) as CardKey[]).map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              // 도는 중인 칸은 비어 있어도 눌린다 — 거기서 무슨 일이
              // 벌어지는지 보러 가는 것이 이 탭의 용도다.
              disabled={!filled[key] && cards[key].status !== "running" && panel !== key}
              className="h-8 flex-none px-0.5 text-sm font-normal"
            >
              {PANEL_TITLE[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {/*
          요약(`goal`)으로 폴백하지 않는다. 분석이 `brief` 를 못 내면 두 탭이
          같은 글자를 그려서, 사용자는 같은 것을 두 번 보고 어느 쪽이 분석
          결과인지 알 수 없다 — 못 만들었으면 못 만들었다고 쓴다.
        */}
        {panel === "analyze" &&
          (brief ? (
            <Prose markdown={brief} />
          ) : (
            <Empty
              card="analyze"
              state={cards.analyze}
              done="공고 분석 결과가 없습니다"
            />
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
            <Empty card="plan" state={cards.plan} />
          ))}

        {panel === "data" &&
          (needs.length ? (
            <NeedsList
              needs={needs}
              values={values}
              onChange={onChangeValue}
              artifacts={artifacts}
              runId={runId}
              sourceNotice={sourceNotice}
              onUpload={onUpload}
            />
          ) : (
            <Empty card="data" state={cards.data} />
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
            <Empty card="file" state={cards.file} />
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
            <Empty card="gather" state={cards.gather} />
          ))}

        {panel === "goal" &&
          (summary ? (
            <Prose markdown={summary.markdown} />
          ) : (
            <Empty card="goal" state={cards.goal} />
          ))}

        {panel === "browser" &&
          (result ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {result}
            </p>
          ) : (
            <Empty card="browser" state={cards.browser} />
          ))}
      </div>
    </aside>
  );
}

/**
 * 「필요한 정보」 탭 — 읽기 전용 목록이 아니라 **입력 자리**다.
 *
 * 예전에는 드로어가 화면을 덮고 열렸다. 항목이 스무 개를 넘기니 그 안에서 또
 * 스크롤이 생겼고, 무엇보다 **공고와 계획을 보면서 채울 수가 없었다** — 값을
 * 확인하려면 드로어를 닫고, 닫으면 어디까지 채웠는지 다시 찾아야 했다.
 *
 * 한 줄에 항목명·값·펼침만 두고, 펼친 자리에서 고친다. 접힌 줄이 곧 현황이라
 * 목록을 훑는 것만으로 「무엇이 비었나」가 읽힌다.
 */
function NeedsList({
  needs,
  values,
  onChange,
  artifacts,
  runId,
  sourceNotice,
  onUpload,
}: {
  needs: Need[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  artifacts: Artifact[];
  runId: string | null;
  sourceNotice: string;
  onUpload: (artifact: Artifact) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className="space-y-1.5">
      {needs.map((need) => {
        const ready = artifacts.find((item) => item.needKey === need.key) ?? null;
        const value =
          need.kind === "file" ? (ready?.filename ?? "") : (values[need.key] ?? "");
        const expanded = open === need.key;
        return (
          <li
            key={need.key}
            className={cn(
              "overflow-hidden rounded-lg bg-muted/40 text-sm",
              expanded && "ring-1 ring-brand/40",
            )}
          >
            <button
              type="button"
              // 한 번에 하나만 연다. 여럿이 열리면 목록이 다시 길어져, 접어 둔
              // 이유가 사라진다.
              onClick={() => setOpen(expanded ? null : need.key)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/60"
            >
              {/*
                긴 값이 항목명을 밀어내지 않게 셋의 몫을 못박는다. `truncate` 만
                걸어 두면 둘 다 자기 내용만큼 자라려 들고, 긴 값 쪽이 이겨서
                항목명이 「기…」 한 글자로 줄고 「필수」가 두 줄로 접혔다(실측).
              */}
              <span className="min-w-0 flex-1 truncate">{need.label}</span>
              {need.required && !value.trim() && (
                <span className="shrink-0 text-xs text-brand">필수</span>
              )}
              <span
                className={cn(
                  "max-w-[45%] min-w-0 shrink-0 truncate text-right text-xs",
                  value.trim() ? "" : "text-muted-foreground",
                )}
                title={value.trim() || undefined}
              >
                {value.trim() || "비어 있음"}
              </span>
              <ChevronUp
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground transition-transform",
                  expanded ? "rotate-0" : "rotate-180",
                )}
              />
            </button>

            {need.from === "memory" && !expanded && (
              <p className="px-3 pb-2 text-[11px] text-brand">
                지식베이스{need.memoryLabel ? ` · ${need.memoryLabel}` : ""}
              </p>
            )}

            {expanded && (
              <div className="border-t border-border/60 px-3 py-3">
                {need.kind === "file" ? (
                  // 파일 칸은 값이 아니라 업로드다. 같은 부품을 쓰되 `<li>` 를
                  // 겹치지 않게 목록 밖에서 하나만 그린다.
                  <ul className="[&>li]:bg-transparent [&>li]:px-0 [&>li]:py-0">
                    <DocumentRow
                      need={need}
                      ready={ready}
                      runId={runId}
                      sourceNotice={sourceNotice}
                      onUpload={onUpload}
                    />
                  </ul>
                ) : (
                  <Field need={need} value={value} onChange={onChange} />
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Button size="xs" onClick={() => setOpen(null)}>
                    저장
                  </Button>
                  {/* 값은 칠 때마다 이미 부모 상태에 들어간다. 이 버튼은 줄을
                      닫을 뿐이라, 「저장 안 하고 닫으면 날아가나」를 없앤다. */}
                  <span className="text-[11px] text-muted-foreground">
                    입력하는 대로 반영됩니다
                  </span>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 그 칸이 도는 동안 무엇을 하고 있는지. 「아직 없습니다」가 답이 아닌 자리들 */
const WORKING: Record<CardKey, string> = {
  goal: "요청하신 내용을 정리하고 있습니다",
  gather: "관련 자료를 모으고 있습니다",
  analyze: "공고를 읽고 신청 양식을 구조화하고 있습니다",
  plan: "진행 순서를 세우고 있습니다",
  data: "필요한 입력 항목을 추리고 있습니다",
  file: "제출할 서류를 만들고 있습니다",
  browser: "신청 페이지를 조작하고 있습니다",
};

/**
 * 빈 판 — **왜** 비었는지 말한다.
 *
 * 도는 중인데 「아직 없습니다」라고 하면, 사용자는 이 단계가 실패했거나
 * 아무 일도 안 하는 것으로 읽는다. 실제로는 왼쪽 카드가 돌고 있고 몇십 초
 * 뒤에 채워진다 — 그 사실이 이 자리에서도 보여야 기다릴 수 있다.
 */
function Empty({
  card,
  state,
  done = "아직 없습니다",
}: {
  card?: CardKey;
  state?: CardState;
  /** 그 단계가 끝났는데도 비었을 때 할 말. 「없다」가 결과인 경우다 */
  done?: string;
}) {
  const status = card && state ? state.status : "done";

  if (status === "running") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Spinner className="size-5 text-brand" />
        <p className="text-sm text-muted-foreground">{WORKING[card!]}</p>
        {/* 서술자가 쓴 한 줄이 있으면 같이 낸다 — 「무엇을 하고 있나」가
            일반 문구보다 그 문장에 더 정확히 들어 있다. */}
        {state?.headline && (
          <p className="text-xs text-muted-foreground/70">{state.headline}</p>
        )}
      </div>
    );
  }

  if (status === "idle") {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        앞 단계가 끝나면 시작합니다
      </p>
    );
  }

  if (status === "skip") {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        이번에는 건너뛴 단계입니다
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {state?.headline ?? "여기서 멈췄습니다"}
      </p>
    );
  }

  return <p className="py-10 text-center text-sm text-muted-foreground">{done}</p>;
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
