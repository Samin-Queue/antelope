import { generateObject } from "ai";
import { z } from "zod";

import type { Ctx } from "./intake";
import { bigModel, clip } from "./llm";
import type { Need, Plan, PlanStep } from "./types";

/**
 * 7단계 — 계획 에이전트.
 *
 * 앞 단계들이 만든 것은 «무엇»이다 — 요약, 필드 목록, 준비 문서. 여기서
 * «언제 · 어디서 · 누가»를 붙인다. 브라우저 에이전트가 들고 다닐 순서표이자,
 * 사람이 읽고 「이대로 하면 되겠다」고 판단할 문서다.
 *
 * 단계마다 **누가 하는지**를 못 박는다. 이 제품에서 사람이 개입하는 지점은
 * 기능이지 예외다 — 공동인증서 발급처럼 대신 못 하는 일을 계획서가 미리
 * 알려 주지 않으면 브라우저 에이전트가 그 앞에서 멈춰 서고 만다.
 */
const OWNERS = ["browser", "data", "file", "user"] as const;

const schema = z.object({
  markdown: z.string().nullish(),
  steps: z
    .array(
      z.object({
        title: z.string().nullish(),
        owner: z.string().nullish(),
        detail: z.string().nullish(),
        dueDate: z.string().nullish(),
        url: z.string().nullish(),
      }),
    )
    .nullish(),
});

export async function makePlan(
  input: {
    title: string;
    organization: string | null;
    deadline: string | null;
    applyUrl: string | null;
    /** 정보 분석 에이전트가 정돈한 준비 문서. 없으면 요약으로 대신한다 */
    brief: string | null;
    summary: string;
    needs: Need[];
    /** 서버가 아는 오늘. 모델에게 날짜를 지어내게 하지 않는다 */
    today: string;
  },
  ctx: Ctx,
): Promise<Plan> {
  const missing = input.needs.filter((need) => !need.value?.trim());
  const documents = input.needs.filter((need) => need.kind === "file");

  const { object } = await generateObject({
    model: bigModel(),
    schema,
    system: [
      "너는 신청 준비 계획을 세우는 계획 에이전트다. 결과를 아래 JSON 구조 그대로 낸다.",
      `{ "markdown": string, "steps": [{ "title": string, "owner": "browser"|"data"|"file"|"user", "detail": string, "dueDate": "YYYY-MM-DD", "url": string }] }`,
      "",
      "owner 는 그 단계를 실제로 수행하는 주체다:",
      "- browser: 신청 사이트에서 회원가입·로그인·폼 입력·제출을 한다",
      "- data: 신청자에게 값을 물어 받는다",
      "- file: 제출용 파일을 만들거나 지정 서식을 채운다",
      "- user: 사람이 직접 해야 한다 (증명서 발급, 본인인증, 공동인증서 등)",
      "",
      "규칙:",
      "- 단계는 실제로 할 수 있는 행동 단위로. 최대 8개. 순서대로.",
      "- dueDate 는 마감에서 역산해 넉넉히 잡는다. 마감을 모르면 비운다. 오늘 이전 날짜를 쓰지 않는다.",
      "- url 은 주어진 신청 URL 이나 원문에 있던 주소만. 지어내지 않는다.",
      "- markdown 은 사람이 읽는 계획서다. '## 무엇을 신청하나', '## 지금 상태',",
      "  '## 진행 순서', '## 사람이 직접 해야 하는 것' 순서로 쓴다.",
      "  진행 순서는 번호 목록으로, 각 항목에 담당과 기한을 함께 적는다.",
      "- 주어진 자료에 없는 절차를 지어내지 않는다. 모르면 '확인 필요' 라고 쓴다.",
      "- Markdown 밖의 인사말·코드 펜스는 쓰지 않는다.",
    ].join("\n"),
    prompt: [
      `오늘: ${input.today}`,
      `신청 대상: ${input.title}`,
      input.organization ? `주관: ${input.organization}` : null,
      input.deadline ? `마감: ${input.deadline}` : "마감: 확인 안 됨",
      input.applyUrl ? `신청 URL: ${input.applyUrl}` : "신청 URL: 아직 못 찾음",
      "",
      `입력 항목 ${input.needs.length}개 중 ${missing.length}개가 비어 있다.`,
      missing.length
        ? `비어 있는 항목: ${missing.map((need) => need.label).join(", ")}`
        : "모든 항목이 채워져 있다.",
      documents.length
        ? `제출 서류: ${documents.map((need) => need.label).join(", ")}`
        : "제출 서류: 없음",
      "",
      "--- 준비 문서 ---",
      clip(input.brief || input.summary, 14_000),
    ]
      .filter((line) => line !== null)
      .join("\n"),
  });

  const steps: PlanStep[] = (object.steps ?? [])
    .map((step, index) => {
      const title = step.title?.trim();
      if (!title) return null;
      const owner = (OWNERS as readonly string[]).includes(step.owner ?? "")
        ? (step.owner as PlanStep["owner"])
        : "user";
      return {
        id: `step-${index + 1}`,
        title,
        owner,
        detail: step.detail?.trim() || null,
        // 과거 날짜는 버린다 — 모델이 마감을 오늘 이전으로 역산하는 일이 있다.
        dueDate: isFutureDate(step.dueDate, input.today) ? step.dueDate!.trim() : null,
        url: step.url?.trim().match(/^https?:\/\//) ? step.url.trim() : null,
      };
    })
    .filter((step): step is PlanStep => step !== null)
    .slice(0, 8);

  const markdown = (object.markdown ?? "")
    .trim()
    .replace(/^```(?:markdown)?\n?|\n?```$/g, "");
  ctx.log(`계획 ${steps.length}단계 · 계획서 ${markdown.length.toLocaleString()}자`);
  return { markdown, steps };
}

function isFutureDate(value: string | null | undefined, today: string): boolean {
  const date = value?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date >= today;
}
