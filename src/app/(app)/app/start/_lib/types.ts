/**
 * 「목표 시작하기」 플로우의 클라이언트·서버 공유 타입.
 *
 * ⚠ 런타임 의존성을 두지 않는다. 화면 컴포넌트는 이 파일에서만 타입을 가져온다 —
 * pipeline 을 import 하면 브라우저 에이전트(node:child_process)가 번들에 끌려 들어간다.
 */

/** 준비 단계. 화면의 진행 레일이 이 순서로 그린다 */
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

export const STAGE_LABEL: Record<Stage, { title: string; agent: string }> = {
  intake: { title: "입력 정리", agent: "solar-mini" },
  summarize: { title: "문서 요약", agent: "유효성 검사 에이전트" },
  judge: { title: "요약 판정", agent: "solar-mini" },
  research: { title: "추가 조사", agent: "solar-pro4" },
  analyze: { title: "양식 분석", agent: "정보 분석 에이전트" },
  prefill: { title: "지식베이스 선채움", agent: "memories" },
  plan: { title: "진행 계획", agent: "계획 에이전트" },
  documents: { title: "서류 작성", agent: "파일 에이전트" },
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
  origin: "upload" | "url" | "crawl";
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
};

export type StartEvent =
  | {
      type: "stage";
      stage: Stage;
      status: "start" | "done" | "error" | "skip";
      detail?: string;
    }
  | { type: "log"; text: string }
  | { type: "files"; files: FileInfo[] }
  | { type: "summary"; markdown: string; via: string }
  /** 정보 분석 의 신청 준비 문서 */
  | { type: "brief"; markdown: string }
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
  | { type: "error"; error: string };

export type ApplyEvent =
  /**
   * 어느 브라우저로 도는가.
   *   auto   — Playwright. DOM 을 직접 읽어 빠르고 정확하다. 캡챠가 없을 때
   *   manual — Xvfb + xdotool. 느리지만 캡챠를 사람이 직접 풀 수 있다
   */
  | { type: "mode"; mode: "auto" | "manual"; reason: string }
  | { type: "session"; sessionId: string }
  | { type: "step"; tool: string; detail: string; title: string }
  | { type: "frame"; image: string; title: string }
  | { type: "need:human"; reason: string }
  | { type: "human:done" }
  | { type: "done"; summary: string; steps: number }
  | { type: "error"; error: string };

/** 신청 URL 이 끝내 없을 때 사람에게 묻는 항목. 화면과 서버가 같은 키를 쓴다 */
export const APPLY_URL_KEY = "신청페이지링크";
