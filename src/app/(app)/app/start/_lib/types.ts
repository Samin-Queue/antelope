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
  summarize: { title: "문서 요약", agent: "Samson" },
  judge: { title: "요약 판정", agent: "solar-mini" },
  research: { title: "추가 조사", agent: "solar-pro4" },
  analyze: { title: "양식 분석", agent: "Michael" },
  prefill: { title: "지식베이스 선채움", agent: "memories" },
};

export type NeedKind =
  "text" | "long" | "date" | "number" | "select" | "checkbox" | "file";

/** 신청자가 채워야 하는 항목 하나. 선채움되면 value 가 들어온다 */
export type Need = {
  /** 정규화된 라벨. 중복 제거 키 */
  key: string;
  label: string;
  kind: NeedKind;
  required: boolean;
  source: "michael" | "research" | "summary";
  /** 왜 필요한지. 원문 근거 */
  why: string | null;
  value: string | null;
  from: "memory" | null;
  /** 기억이 다른 이름으로 저장돼 있었을 때 그 이름 */
  memoryLabel?: string;
};

export type FileInfo = {
  name: string;
  origin: "upload" | "url" | "crawl";
  bytes: number;
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
  | { type: "verdict"; verdict: "good" | "bad"; reason: string }
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
