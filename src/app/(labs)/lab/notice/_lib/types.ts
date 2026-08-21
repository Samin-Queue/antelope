/**
 * 클라이언트와 서버가 공유하는 타입·상수.
 *
 * ⚠ 이 파일은 런타임 의존성을 갖지 않는다. orchestrator 를 클라이언트에서
 * import 하면 playwright 가 브라우저 번들로 끌려가 `async_hooks` 를 못 찾고
 * 빌드가 통째로 깨진다. UI 는 반드시 여기서만 가져간다.
 */
import type { DocumentPlan, Eligibility, Outline } from "./agents";

export type AgentId = "eligibility" | "documents" | "outline" | "browser";

/** 가상 데스크톱 해상도. 라이브 뷰가 클릭 좌표를 이 기준으로 환산한다 */
export const LIVE_SCREEN = { width: 1280, height: 900 } as const;

/**
 * 사람이 라이브 화면에서 보내는 조작. 좌표는 LIVE_SCREEN 기준 픽셀이다.
 * 브라우저 DOM 이 아니라 xdotool 로 X 서버에 들어가므로 캡챠 iframe 안도 똑같이 눌린다.
 */
export type LiveInput =
  | { kind: "click"; x: number; y: number }
  | { kind: "dblclick"; x: number; y: number }
  | { kind: "move"; x: number; y: number }
  | { kind: "drag"; x: number; y: number; toX: number; toY: number }
  | { kind: "scroll"; x: number; y: number; dy: number }
  | { kind: "type"; text: string }
  | { kind: "key"; key: string };

export const AGENT_LABEL: Record<AgentId, string> = {
  eligibility: "자격 판정",
  documents: "서류 준비 계획",
  outline: "신청서 설계",
  browser: "신청 폼 작성",
};

export type TraceEntry = {
  step: number;
  tool: string;
  input: unknown;
  output: string;
  url?: string;
};

export type BrowserRun = {
  summary: string;
  steps: number;
  finalUrl: string;
  trace: TraceEntry[];
};

export type PipelineResult = {
  eligibility: Eligibility | null;
  documents: DocumentPlan | null;
  outline: Outline | null;
  browser: BrowserRun | null;
  errors: Partial<Record<AgentId, string>>;
};

export type RunEvent =
  | { type: "start"; agents: AgentId[] }
  | { type: "agent:start"; agent: AgentId }
  | { type: "agent:step"; agent: AgentId; tool: string; detail: string; url?: string }
  /** 브라우저 화면. data:image/jpeg;base64 — 조작할 때마다 한 장씩 흘린다 */
  | { type: "frame"; agent: AgentId; image: string; url: string }
  /** 세션 id. 클라이언트가 /lab/notice/live 로 라이브 뷰를 붙일 주소다 */
  | { type: "session"; sessionId: string }
  /** 에이전트가 멈추고 사람을 기다린다 — 캡챠 등 */
  | { type: "need:human"; reason: string }
  /** 사람이 끝내고 에이전트가 다시 움직인다 */
  | { type: "human:done" }
  | { type: "agent:done"; agent: AgentId; ms: number }
  | { type: "agent:error"; agent: AgentId; error: string }
  | { type: "result"; result: PipelineResult }
  | { type: "end"; ms: number };
