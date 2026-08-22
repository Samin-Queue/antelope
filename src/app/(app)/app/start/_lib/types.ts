/**
 * 「목표 시작하기」 플로우의 클라이언트·서버 공유 타입.
 *
 * ⚠ 런타임 의존성을 두지 않는다. 화면 컴포넌트는 이 파일에서만 타입을 가져온다 —
 * pipeline 을 import 하면 브라우저 에이전트(node:child_process)가 번들에 끌려 들어간다.
 */

/**
 * 화면의 카드 하나 = 에이전트 하나.
 *
 * 준비(`/run`)와 신청(`/apply`)은 **다른 스트림**이지만 같은 어휘를 쓴다.
 * 그래야 브라우저가 도중에 데이터·파일·계획을 되부를 때 같은 그리드에서
 * 여러 칸이 함께 켜진다 — 티키타카가 화면에 그대로 보이는 것이 요점이다.
 *
 * 8칸이 그리드(4×2), 브라우저는 그 아래 전폭이다. 1280×900 화면을 1/8 칸에
 * 넣으면 무엇을 하는지 안 읽힌다.
 */
export type Stage =
  | "intake"
  | "summarize"
  | "judge"
  | "research"
  | "analyze"
  | "prefill"
  | "plan"
  | "documents";

export const STAGES: Stage[] = [
  "intake",
  "summarize",
  "judge",
  "research",
  "analyze",
  "prefill",
  "plan",
  "documents",
];

/** 브라우저까지 포함한 전체 어휘. 두 스트림이 이걸로 말한다 */
export type AgentKey = Stage | "browser";

/**
 * 화면의 카드.
 *
 * 단계와 1:1 이 아니다 — 「유효성 검사」·「착수 판정」 은 우리 내부 용어이고,
 * 사용자가 알아야 하는 것은 「목표를 파악했다」·「자료를 모았다」 다.
 * 여러 단계가 한 카드로 모인다.
 */
export type CardKey =
  "goal" | "gather" | "analyze" | "plan" | "data" | "file" | "browser";

export const CARDS: CardKey[] = [
  "goal",
  "gather",
  "analyze",
  "plan",
  "data",
  "file",
  "browser",
];

export const CARD_LABEL: Record<CardKey, string> = {
  goal: "목표 파악",
  gather: "배경 정보 수집",
  analyze: "수집 자료 분석",
  plan: "계획 수립",
  data: "필요 데이터 수집",
  file: "파일 에디터",
  browser: "작업 실행",
};

/** 단계가 어느 카드에 속하는가 */
export const CARD_OF: Record<AgentKey, CardKey> = {
  intake: "goal",
  judge: "goal",
  research: "gather",
  summarize: "analyze",
  analyze: "analyze",
  plan: "plan",
  prefill: "data",
  documents: "file",
  browser: "browser",
};

export const STAGE_LABEL: Record<AgentKey, { title: string; agent: string }> = {
  intake: { title: "입력 정리", agent: "solar-mini" },
  summarize: { title: "유효성 검사", agent: "Studio" },
  judge: { title: "착수 판정", agent: "solar-mini" },
  research: { title: "자료 조사", agent: "solar-pro4" },
  analyze: { title: "정보 분석", agent: "Studio" },
  prefill: { title: "데이터", agent: "지식베이스" },
  plan: { title: "계획", agent: "solar-pro4" },
  documents: { title: "파일", agent: "파일 에이전트" },
  browser: { title: "브라우저", agent: "실제 사이트 조작" },
};

export type NeedKind =
  "text" | "long" | "date" | "number" | "select" | "checkbox" | "file";

/**
 * 신청자가 채워야 하는 항목 하나.
 *
 * 이 배열이 곧 **세션의 마스터 테이블**이다. 브라우저·파일 에이전트는 여기만
 * 읽는다 — 각자 들고 있는 값으로 폼을 채우면 어느 값이 맞는지 알 수 없다.
 */
export type Need = {
  /** 정규화된 라벨. 중복 제거 키 */
  key: string;
  label: string;
  kind: NeedKind;
  /** kind 가 select 일 때 고를 수 있는 값. 없으면 자유 입력으로 그린다 */
  options?: string[];
  required: boolean;
  source: "analysis" | "research" | "summary";
  /** 왜 필요한지. 원문 근거 */
  why: string | null;
  value: string | null;
  /** 값이 어디서 왔는가. null 이면 아직 비었다 */
  from: "memory" | "user" | "agent" | null;
  /** 기억이 다른 이름으로 저장돼 있었을 때 그 이름 */
  memoryLabel?: string;
  /**
   * 이 값의 근거 — 원문 요소 id.
   *
   * **못 찾으면 비운다.** 아무 블록이나 칠하면 하이라이트가 근거인 척하는
   * 장식이 되고, 이 제품이 파는 게 정확히 그 신뢰다.
   */
  evidenceIds?: number[];
  /**
   * 공고가 지정한 서식 파일 이름.
   *
   * Studio 의 추출 스키마가 이미 요구하는 값인데(`formName`) 우리 zod 스키마에
   * 없어서 조용히 버려지고 있었다. 이것이 없으면 `fillTemplates` 가 첨부 확장자
   * 로만 서식을 찾고, 채운 파일을 **어느 업로드 칸에 넣을지 모른다.**
   */
  formName?: string;
};

/**
 * 계획서의 한 단계.
 *
 * `owner` 가 핵심이다 — 사람이 직접 해야 하는 일(증명서 발급·본인인증)을
 * 미리 갈라 두지 않으면 브라우저 에이전트가 그 앞에서 멈춰 선다.
 */
export type PlanStep = {
  id: string;
  title: string;
  owner: "browser" | "data" | "file" | "user";
  detail: string | null;
  /** YYYY-MM-DD. 마감에서 역산한다 */
  dueDate: string | null;
  url: string | null;
};

export type Plan = {
  /** 사람이 읽는 계획서 */
  markdown: string;
  steps: PlanStep[];
};

export const PLAN_OWNER_LABEL: Record<PlanStep["owner"], string> = {
  browser: "브라우저",
  data: "정보 수집",
  file: "파일 작성",
  user: "직접",
};

/**
 * 파일 에이전트가 만든 제출용 파일.
 *
 * `path` 는 **컨테이너 안 임시 경로**다. 재시작하면 사라지므로 오래 기대지
 * 않는다 — 없으면 다시 만든다.
 */
/** 제출 파일 형식. 공고가 요구한 것을 따른다 */
export type DocFormat = "pdf" | "hwp" | "hwpx" | "docx" | "xlsx";

export type Artifact = {
  /** 이 파일이 채우는 마스터 테이블 항목 */
  needKey: string;
  label: string;
  filename: string;
  mime: string;
  bytes: number;
  path: string;
  /** 어떤 값으로 채웠는지 — 마스터 테이블 key 목록 */
  usedKeys: string[];
  /** 어디서 왔는가. agent=파일 에이전트가 씀, memory=보관함, user=직접 올림 */
  from: "agent" | "memory" | "user";
};

export type FileInfo = {
  name: string;
  /** `synth` 는 우리가 만들어 Studio 에 넘긴 것. 사용자가 준 원본과 구분한다 */
  origin: "upload" | "url" | "crawl" | "synth";
  bytes: number;
};

/**
 * 세션 스냅샷 — 다시 열었을 때 이어서 하려면 이만큼이 있어야 한다.
 *
 * 파일은 **바이트를 담지 않는다.** 목록과 출처만 남긴다 — jsonb 하나에 PDF 를
 * 넣으면 행이 수 MB 가 되고, 다시 필요하면 origin 으로 받으면 된다.
 */
export type SessionSnapshot = {
  title: string;
  organization: string | null;
  deadline: string | null;
  applyUrl: string | null;
  summary: { markdown: string; via: string } | null;
  /** 정보 분석 이 정돈한 신청 준비 문서. 계획 에이전트의 입력이 된다 */
  brief: string | null;
  files: FileInfo[];
  /** 마스터 테이블 */
  needs: Need[];
  /** 진행 계획. 브라우저 에이전트가 들고 다닐 순서표 */
  plan: Plan | null;
  /** 파일 에이전트가 만든 제출용 파일 */
  artifacts: Artifact[];
  /** 어디까지 갔는지. 다시 열었을 때 레일을 그대로 그린다 */
  stages: Partial<Record<Stage, "done" | "error" | "skip">>;
  /**
   * 오케스트레이터가 카드에 쓴 문장.
   *
   * 이게 없으면 지난 세션을 다시 열었을 때 **카드가 텅 빈다** — 상태 색만 남고
   * 「무엇을 알아냈고 그래서 다음이 무엇인지」가 사라진다. 라이브에서 본 화면과
   * 같은 것을 보여주려면 이게 있어야 한다. 파이프라인이 이미 `history` 로
   * 들고 있으므로 담는 비용은 0 이다.
   */
  narration?: Array<{ card: CardKey; headline: string; body: string }>;
  /**
   * 이 실행이 파일을 담은 폴더 id.
   *
   * 지난 세션에서 서류를 더 올릴 때 같은 폴더를 쓴다. 재시작 뒤에는 폴더가
   * 비어 있을 수 있지만, 그때는 다시 만들면 된다.
   */
  runId?: string;
  /**
   * 근거로 쓸 원문 요소와 좌표.
   *
   * 응답 크기 때문에 **단어별 좌표는 버리고 요소 단위로만** 담는다 — 1쪽짜리
   * 공고 기준 5KB 안팎이다. Studio 를 안 탄 경로에서는 비어 있다.
   */
  evidence?: Array<{
    id: number;
    page: number;
    category: string;
    text: string;
    box: { x: number; y: number; w: number; h: number };
  }>;
};

export type StartEvent =
  | {
      type: "stage";
      stage: Stage;
      status: "start" | "done" | "error" | "skip";
      detail?: string;
      /** 이 단계가 실제로 걸린 시간. 어디가 느린지는 추측이 아니라 이 값이 답한다 */
      ms?: number;
    }
  /** 어느 카드의 로그인지. 없으면 화면 전체 로그 */
  | { type: "log"; stage?: Stage; text: string }
  | { type: "files"; files: FileInfo[] }
  | { type: "summary"; markdown: string; via: string }
  /** 정보 분석 의 신청 준비 문서 */
  | { type: "brief"; markdown: string }
  /** 어느 단계가 실제로 무엇으로 돌았는지. 고정 라벨이 거짓이 되는 자리를 고친다 */
  | { type: "via"; stage: Stage; via: string }
  /**
   * 오케스트레이터가 도는 동안. 단계 사이 공백이 여기다 — 이걸 안 보내면
   * 아무 칸도 안 켜진 채로 몇 초가 흐르고, 화면이 사실보다 조용해진다.
   */
  | { type: "orchestrator"; status: "start" | "done" }
  /** 오케스트레이터가 쓴 상태 문장. 카드에 그대로 뜬다 */
  | { type: "card"; card: CardKey; headline: string; body: string }
  | { type: "plan"; plan: Plan }
  | { type: "artifacts"; artifacts: Artifact[] }
  /** 이번 실행이 파일을 담는 폴더 id. 사용자가 서류를 올릴 때 같이 보낸다 */
  | { type: "run"; runId: string }
  | { type: "verdict"; verdict: "good" | "bad"; reason: string }
  /** 세션이 DB 에 만들어졌다. 이후 갱신은 이 id 로 한다 */
  | { type: "session"; id: string }
  | {
      type: "needs";
      title: string;
      organization: string | null;
      deadline: string | null;
      applyUrl: string | null;
      needs: Need[];
    }
  /**
   * 준비가 끝났다. **모든 종료 경로가 이걸 보낸다** — 성공이든, 요약이 bad
   * 라 멈췄든, 판정이 실패했든.
   *
   * 이게 없으면 「서버가 스스로 끝냈다」와 「연결이 끊겼다」가 화면에서
   * 구분되지 않는다. 실제로 `judge` 실패와 `bad` 판정이 아무 이벤트도 없이
   * 조용히 스트림을 닫고 있었고, 화면에는 「연결이 끊겨 중단됐다」만 떴다.
   */
  | { type: "end"; reason: "ready" | "stopped"; detail?: string }
  | { type: "error"; error: string };

export type ApplyEvent =
  /**
   * 어느 브라우저로 도는가.
   *   auto   — Playwright. DOM 을 직접 읽어 빠르고 정확하다. 캡챠가 없을 때
   *   manual — Xvfb + xdotool. 느리지만 캡챠를 사람이 직접 풀 수 있다
   */
  | { type: "mode"; mode: "auto" | "manual"; reason: string }
  | { type: "session"; sessionId: string }
  /**
   * 브라우저가 도중에 되부른 에이전트의 상태.
   * 브라우저 카드와 **함께** 켜져 「누가 누구를 부르는지」가 보인다.
   */
  | {
      type: "agent";
      agent: AgentKey;
      status: "start" | "done" | "error";
      detail?: string;
    }
  /** 값이 없어 사용자에게 묻는다. 답이 올 때까지 브라우저는 멈춰 기다린다 */
  | { type: "ask"; id: string; label: string; why: string; kind: NeedKind }
  | { type: "answered"; id: string; label: string }
  /**
   * 오케스트레이터가 도는 동안. 단계 사이 공백이 여기다 — 이걸 안 보내면
   * 아무 칸도 안 켜진 채로 몇 초가 흐르고, 화면이 사실보다 조용해진다.
   */
  | { type: "orchestrator"; status: "start" | "done" }
  /** 신청 도중의 서술. 준비 단계와 같은 카드에 쌓인다 */
  | { type: "card"; card: CardKey; headline: string; body: string }
  | { type: "step"; tool: string; detail: string; title: string }
  | { type: "frame"; image: string; title: string }
  | { type: "need:human"; reason: string }
  | { type: "human:done" }
  | { type: "done"; summary: string; steps: number }
  | { type: "error"; error: string };

/** 신청 URL 이 끝내 없을 때 사람에게 묻는 항목. 화면과 서버가 같은 키를 쓴다 */
export const APPLY_URL_KEY = "신청페이지링크";
