/**
 * 「목표 시작하기」 플로우의 클라이언트·서버 공유 타입.
 *
 * ⚠ 런타임 의존성을 두지 않는다. 화면 컴포넌트는 이 파일에서만 타입을 가져온다 —
 * pipeline 을 import 하면 브라우저 에이전트(node:child_process)가 번들에 끌려 들어간다.
 */

/** 1~5 단계. 화면의 진행 레일이 이 순서로 그린다 */
export type Stage = "intake" | "summarize" | "judge" | "research" | "analyze" | "prefill";

export const STAGES: Stage[] = [
  "intake",
  "summarize",
  "judge",
  "research",
  "analyze",
  "prefill",
];

export const STAGE_LABEL: Record<Stage, { title: string; agent: string }> = {
  intake: { title: "입력 정리", agent: "solar-mini" },
  summarize: { title: "문서 요약", agent: "유효성 검사 에이전트" },
  judge: { title: "요약 판정", agent: "solar-mini" },
  research: { title: "추가 조사", agent: "solar-pro4" },
  analyze: { title: "양식 분석", agent: "정보 분석 에이전트" },
  prefill: { title: "지식베이스 선채움", agent: "memories" },
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
  | { type: "session"; sessionId: string }
  | { type: "step"; tool: string; detail: string; title: string }
  | { type: "frame"; image: string; title: string }
  | { type: "need:human"; reason: string }
  | { type: "human:done" }
  | { type: "done"; summary: string; steps: number }
  | { type: "error"; error: string };

/** 신청 URL 이 끝내 없을 때 사람에게 묻는 항목. 화면과 서버가 같은 키를 쓴다 */
export const APPLY_URL_KEY = "신청페이지링크";
