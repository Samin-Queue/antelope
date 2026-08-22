import { generateObject } from "ai";
import { z } from "zod";

import { drill, urlsIn, type IntakeFile, type Link, type Page } from "./fetch";
import { MAX_FILES, type Ctx, type Intake } from "./intake";
import { bigModel, clip } from "./llm";
import { makeNeed } from "./needs";
import type { Summary } from "./summarize";
import { APPLY_URL_KEY, type Need } from "./types";

/**
 * 3단계 — 추가 조사.
 *
 * 요약만으로는 신청을 못 한다. 어디서 신청하는지(신청 URL)와 무엇을 내야 하는지
 * (첨부 양식)가 대개 링크 뒤에 있다. 1단계가 본 링크와 요약 속 URL 을 후보로
 * 모델이 고르고, 고른 것은 실제로 가서 읽는다.
 *
 * 신청 페이지를 읽으면 폼 라벨이 보인다. 그게 곧 「유저가 입력해야 할 내용」 이다.
 */
export type Research = {
  files: IntakeFile[];
  applyUrl: string | null;
  applyPage: Page | null;
  needs: Need[];
  title: string;
  organization: string | null;
  deadline: string | null;
};

const APPLY_HINT = /신청|접수|지원하기|응모|등록|apply|submit|register|form/i;

export async function research(
  intake: Intake,
  summary: Summary,
  ctx: Ctx,
): Promise<Research> {
  const candidates = collectCandidates(intake, summary);
  ctx.log(`링크 후보 ${candidates.length}개`);

  const picked = await pickLinks(intake.intent, summary.markdown, candidates);
  const title =
    picked.title || intake.files[0]?.name || intake.pages[0]?.title || "제목 미상";

  // 첨부 — 1단계가 이미 받은 것은 빼고 받는다.
  const files: IntakeFile[] = [];
  for (const url of picked.attachments) {
    if (intake.files.length + files.length >= MAX_FILES) {
      ctx.log(`파일 상한 ${MAX_FILES}개 — 나머지 첨부는 건너뜀`);
      break;
    }
    if (intake.files.some((file) => file.url === url)) continue;
    try {
      const result = await drill(url, "crawl");
      if (result.kind === "file") {
        files.push(result.file);
        ctx.log(`관련 파일 저장: ${result.file.name}`);
      }
    } catch (error) {
      ctx.log(`첨부 실패: ${message(error)}`);
    }
  }

  // 신청 페이지 — 실제로 열어 폼이 무엇을 묻는지 본다.
  let applyUrl = picked.applyUrl;
  let applyPage: Page | null = null;
  if (applyUrl) {
    const already = intake.pages.find((page) => page.url === applyUrl);
    if (already) {
      applyPage = already;
    } else {
      try {
        const result = await drill(applyUrl, "crawl");
        if (result.kind === "page") {
          applyPage = result.page;
          applyUrl = result.page.url;
        } else {
          // 신청 "페이지" 라더니 파일이다 — 양식으로 저장하고 URL 은 비운다.
          files.push(result.file);
          ctx.log(`신청 링크가 파일이라 양식으로 저장: ${result.file.name}`);
          applyUrl = null;
        }
      } catch (error) {
        ctx.log(`신청 페이지 실패: ${message(error)}`);
      }
    }
    if (applyPage) {
      ctx.log(
        `신청 페이지: ${applyPage.title || applyUrl} · 폼 항목 ${applyPage.formHints.length}개`,
      );
    }
  } else {
    ctx.log("신청 URL 을 찾지 못함 — 사람에게 묻는다");
  }

  const needs = await deriveNeeds(summary.markdown, applyPage);
  ctx.log(`입력 항목 ${needs.length}개 도출`);

  if (!applyUrl) {
    needs.unshift({
      key: APPLY_URL_KEY,
      label: "신청 페이지 링크",
      kind: "text",
      required: true,
      source: "research",
      why: "공고와 첨부에서 신청 페이지를 찾지 못했다. 링크를 주면 이어서 신청한다.",
      value: null,
      from: null,
    });
  }

  return {
    files,
    applyUrl,
    applyPage,
    needs,
    title,
    organization: picked.organization,
    deadline: picked.deadline,
  };
}

/** 후보 링크. 신청·첨부처럼 보이는 것을 앞에 두고 60개로 자른다 */
function collectCandidates(intake: Intake, summary: Summary): Link[] {
  const seen = new Set<string>();
  const out: Link[] = [];
  const push = (link: Link) => {
    if (seen.has(link.url)) return;
    seen.add(link.url);
    out.push(link);
  };
  for (const url of urlsIn(`${summary.markdown}\n${intake.sourceText ?? ""}`)) {
    push({ url, text: "(요약 본문)", isDocument: false });
  }
  const ranked = [...intake.links].sort(
    (a, b) => score(b) - score(a) || a.url.length - b.url.length,
  );
  for (const link of ranked) push(link);
  return out.slice(0, 60);
}

function score(link: Link): number {
  return (APPLY_HINT.test(link.text) ? 2 : 0) + (link.isDocument ? 1 : 0);
}

const pickSchema = z.object({
  title: z.string().nullish(),
  organization: z.string().nullish(),
  deadline: z.string().nullish(),
  applyUrl: z.string().nullish(),
  attachments: z.array(z.string()).nullish(),
});

async function pickLinks(intent: string, markdown: string, candidates: Link[]) {
  const fallback = {
    title: "",
    organization: null as string | null,
    deadline: null as string | null,
    applyUrl: heuristicApplyUrl(candidates),
    attachments: [] as string[],
  };
  try {
    const { object } = await generateObject({
      model: bigModel(),
      schema: pickSchema,
      system: [
        "너는 공고 요약과 링크 목록을 보고 신청에 필요한 것을 고르는 조사원이다.",
        "결과를 아래 JSON 구조 그대로 낸다. 키 이름을 바꾸거나 새로 만들지 않는다.",
        `{ "title": string, "organization": string|null, "deadline": string|null, "applyUrl": string|null, "attachments": [string] }`,
        "",
        "- title: 공고 제목. organization: 주관 기관. deadline: 접수 마감 (YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm).",
        "- applyUrl: 실제로 신청서를 작성·제출하는 페이지. 목록에 있는 URL 만 쓴다. 없으면 null.",
        "  공고 상세 페이지·목록 페이지는 신청 페이지가 아니다. '신청하기' '접수' '지원하기' 링크가 그것이다.",
        "- attachments: 공고문·모집요강·신청서 양식·제출 서식 파일 링크. 목록에 있는 URL 만, 최대 3개.",
        "- 요약에 없는 사실을 지어내지 않는다.",
      ].join("\n"),
      prompt: [
        `목표: ${intent}`,
        "",
        "요약:",
        clip(markdown, 10_000),
        "",
        candidates.length ? "링크 목록:" : "링크 목록: (없음)",
        ...candidates.map(
          (link, i) => `${i + 1}. ${link.text || "(글자 없음)"} — ${link.url}`,
        ),
      ].join("\n"),
    });
    const allowed = new Set(candidates.map((link) => link.url));
    const applyUrl =
      object.applyUrl && allowed.has(object.applyUrl) ? object.applyUrl : null;
    return {
      title: object.title?.trim() ?? "",
      organization: object.organization?.trim() || null,
      deadline: object.deadline?.trim() || null,
      applyUrl: applyUrl ?? fallback.applyUrl,
      attachments: (object.attachments ?? [])
        .filter((url) => allowed.has(url))
        .slice(0, 3),
    };
  } catch {
    return fallback;
  }
}

/** 모델 없이도 「신청하기」 글자가 달린 링크는 집을 수 있다 */
function heuristicApplyUrl(candidates: Link[]): string | null {
  const hit = candidates.find(
    (link) =>
      !link.isDocument &&
      /신청하기|온라인 신청|접수하기|지원하기|apply now/i.test(link.text),
  );
  return hit?.url ?? null;
}

const needsSchema = z.object({
  needs: z
    .array(
      z.object({
        label: z.string(),
        kind: z.string().nullish(),
        options: z.array(z.string()).nullish(),
        required: z.boolean().nullish(),
        why: z.string().nullish(),
      }),
    )
    .nullish(),
});

/**
 * 신청자가 입력해야 하는 항목.
 * 신청 페이지가 있으면 그 폼의 라벨이 1차 근거다. 없으면 요약에서 추론한다.
 */
async function deriveNeeds(markdown: string, applyPage: Page | null): Promise<Need[]> {
  const source: Need["source"] = applyPage ? "research" : "summary";
  try {
    const { object } = await generateObject({
      model: bigModel(),
      schema: needsSchema,
      system: [
        "너는 공고를 읽고 신청자가 직접 입력해야 하는 항목을 정리하는 설계자다.",
        "결과를 아래 JSON 구조 그대로 낸다. 키 이름을 바꾸거나 새로 만들지 않는다.",
        `{ "needs": [{ "label": string, "kind": "text"|"long"|"date"|"number"|"select"|"checkbox"|"file", "options": [string], "required": boolean, "why": string }] }`,
        "- **`select` 이면 `options` 에 고를 값을 넣는다.** 원문에 선택지가 적혀 있으면 그대로, 없으면 그 항목에서 실제로 가능한 값(예: 투자 단계 → 시드/시리즈 A/시리즈 B/해당 없음). 선택지를 못 만들겠으면 `text` 로 둔다 — 고를 것이 없는데 고르라고 하지 않는다.",
        "",
        "- 신청 페이지의 폼 항목이 주어지면 그것을 **그대로** 항목으로 만든다. 라벨 글자를 바꾸지 않는다.",
        "- 제출 서류(파일 업로드)는 kind 를 file 로 둔다.",
        "- 동의·확인 체크는 checkbox. 긴 서술(자기소개, 사업 내용)은 long.",
        "- why 는 공고의 어느 대목 때문에 묻는지 한 문장.",
        "- 섹션 제목(기본 정보, 제출 서류)과 예시 값(010-0000-0000, https://…)은 항목이 아니다. 넣지 않는다.",
        "- 공고에 없는 항목을 지어내지 않는다. 최대 20개.",
      ].join("\n"),
      prompt: [
        "요약:",
        clip(markdown, 10_000),
        "",
        applyPage
          ? [
              `신청 페이지: ${applyPage.title || applyPage.url}`,
              "폼 라벨 (이것이 항목이다):",
              ...applyPage.formHints.map((hint) => `  - ${hint}`),
              "",
              "플레이스홀더 (예시 값일 뿐 항목이 아니다):",
              ...applyPage.placeholders.map((hint) => `  - ${hint}`),
              "",
              "신청 페이지 본문:",
              clip(applyPage.text, 6_000),
            ].join("\n")
          : "신청 페이지: (없음 — 요약에서 추론한다)",
      ].join("\n"),
    });
    return (object.needs ?? [])
      .map((item) =>
        makeNeed({
          label: item.label,
          kind: item.kind,
          options: item.options,
          required: item.required,
          why: item.why,
          source,
        }),
      )
      .filter((need): need is Need => need !== null)
      .slice(0, 20);
  } catch {
    // 모델이 실패하면 폼 라벨이라도 그대로 항목으로 만든다.
    return (applyPage?.formHints ?? [])
      .map((hint) => makeNeed({ label: hint, source }))
      .filter((need): need is Need => need !== null);
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
