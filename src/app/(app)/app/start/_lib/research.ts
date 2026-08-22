import { z } from "zod";

import { dropped, isAbort, runObject } from "@/lib/ai/gateway";
import { isoDate, noPlaceholder, uniqueBy } from "@/lib/ai/verify";

import { drill, urlsIn, type IntakeFile, type Link, type Page } from "./fetch";
import { harvest, HARVEST_BUDGET, harvestSummary } from "./harvest";
import { type Ctx, type Intake } from "./intake";
import { clip } from "./llm";
import { makeNeed, NEED_RULES, normalizeKey } from "./needs";
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
  /** 2홉째에 새로 연 상세 페이지. 요약이 이 본문도 읽어야 정보가 안 샌다 */
  pages: Page[];
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
  /**
   * 자료 수집 — **여기가 2홉을 판다. 그리고 링크를 고르기 전에 돈다.**
   *
   * 요약을 손에 쥔 시점이라 「이 공고가 무엇인지」를 안다. 그래야 상세 페이지를
   * 열어도 무관한 공고를 안 끌어온다(1단계는 그걸 몰라서 1홉에서 멈춘다).
   *
   * 예전에는 모델이 고른 첨부 **3개**를 받고 끝이었다. 수백 쪽을 한 job 에 받는
   * 인프라를 놓고 세 개만 넣던 것이고, 링크가 목록 페이지면 그 셋도 0개였다.
   *
   * ⚠ **순서가 결함이었다.** 예전에는 `pickLinks` 가 여기보다 **먼저** 돌았다.
   * 후보는 시드 페이지의 `<a>`(=`intake.links`)뿐이었으므로, 목록 → 상세로 한
   * 홉 더 들어가야 보이는 「신청하기」는 모델에게 보여준 적이 없다. 사용자가
   * 던진 링크가 게시판 목록이면 `applyUrl` 이 **항상** null 이었고, 매번 같은
   * 「신청 페이지 링크」를 사람에게 물었다.
   */
  const found = await harvest(
    {
      seeds: intake.pages,
      intent: intake.intent,
      have: intake.files,
      depth: 2,
      budget: HARVEST_BUDGET,
    },
    ctx,
  );
  const files: IntakeFile[] = [...found.files];
  const pages: Page[] = found.pages;
  for (const line of found.skipped) ctx.log(`건너뜀: ${line}`);

  const candidates = collectCandidates(intake, summary, pages);
  ctx.log(`링크 후보 ${candidates.length}개 (2홉 상세 페이지 ${pages.length}개 포함)`);

  const picked = await pickLinks(intake.intent, summary.markdown, candidates, ctx);
  const title =
    picked.title || intake.files[0]?.name || intake.pages[0]?.title || "제목 미상";

  /**
   * 모델이 요약 본문에서 집어낸 첨부는 **따로 받는다.**
   *
   * `harvest` 는 페이지의 `<a href>` 만 본다. 요약 안에 평문으로 적힌 다운로드
   * 주소는 거기 없다 — 「붙임 1. 공고문(http://…/file.hwp)」처럼 본문에 박혀 있는
   * 경우가 실제로 있다.
   */
  const already = new Set([
    ...intake.files.map((file) => file.url),
    ...files.map((file) => file.url),
  ]);
  for (const url of picked.attachments) {
    if (already.has(url)) continue;
    try {
      const result = await drill(url, "crawl");
      if (result.kind === "file") {
        files.push(result.file);
        ctx.log(`요약 본문의 첨부: ${result.file.name}`);
      }
    } catch (error) {
      ctx.log(`첨부 실패: ${message(error)}`);
    }
  }
  ctx.log(`수집 합계: ${harvestSummary([...intake.files, ...files])}`);

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

  const needs = await deriveNeeds(summary.markdown, applyPage, ctx);
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
    pages,
    applyUrl,
    applyPage,
    needs,
    title,
    organization: picked.organization,
    deadline: picked.deadline,
  };
}

/** 후보 링크 상한. 프롬프트에 그대로 실리므로 무한정 늘릴 수 없다 */
const MAX_CANDIDATES = 60;
/**
 * 요약 본문에서 뽑은 URL 의 몫.
 *
 * 예전에는 이것들을 **전부 앞에** 넣고 나머지를 60개까지 채웠다. 요약이 긴
 * 공고는 본문 URL 만으로 상한을 다 써서, 앵커 글자가 「신청하기」인 진짜 후보가
 * 목록 밖으로 밀려났다. 앵커 글자가 없는 평문 URL 은 애초에 순위를 매길 수
 * 없으므로 몫을 정해 자른다.
 */
const SUMMARY_URL_SHARE = 12;

/** 후보 링크. 신청·첨부처럼 보이는 것을 앞에 둔다 */
export function collectCandidates(
  intake: Intake,
  summary: Summary,
  extra: Page[],
): Link[] {
  const seen = new Set<string>();
  const out: Link[] = [];
  const push = (link: Link) => {
    if (seen.has(link.url)) return;
    seen.add(link.url);
    out.push(link);
  };
  for (const url of urlsIn(`${summary.markdown}\n${intake.sourceText ?? ""}`).slice(
    0,
    SUMMARY_URL_SHARE,
  )) {
    push({ url, text: "(요약 본문)", isDocument: false });
  }
  /**
   * 2홉에서 연 상세 페이지의 링크도 후보다. **신청 URL 은 거의 여기 있다** —
   * 목록 페이지에는 「신청하기」가 없고 상세 페이지에 있다.
   */
  const ranked = [...intake.links, ...extra.flatMap((page) => page.links)].sort(
    (a, b) => score(b) - score(a) || a.url.length - b.url.length,
  );
  for (const link of ranked) push(link);
  return out.slice(0, MAX_CANDIDATES);
}

/** 앵커 글자가 비어 있는 사이트가 흔하다. 주소도 같이 본다 */
function score(link: Link): number {
  return (
    (APPLY_HINT.test(link.text) ? 2 : 0) +
    (APPLY_HINT.test(link.url) ? 1 : 0) +
    (link.isDocument ? 1 : 0)
  );
}

const pickSchema = z.object({
  title: z.string().nullish(),
  organization: z.string().nullish(),
  deadline: z.string().nullish(),
  applyUrl: z.string().nullish(),
  attachments: z.array(z.string()).nullish(),
});

async function pickLinks(intent: string, markdown: string, candidates: Link[], ctx: Ctx) {
  const fallback = {
    title: "",
    organization: null as string | null,
    deadline: null as string | null,
    applyUrl: heuristicApplyUrl(candidates),
    attachments: [] as string[],
  };
  const allowed = new Set(candidates.map((link) => link.url));
  try {
    const { value } = await runObject(
      { task: "research", log: ctx.log, signal: ctx.signal },
      {
        role: "너는 공고 요약과 링크 목록을 보고 신청에 필요한 것을 고르는 조사원이다.",
        schema: pickSchema,
        rules: [
          "- title: 공고 제목. organization: 주관 기관.",
          "- deadline: 접수 마감. **`YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm` 만 쓴다.** 「9월 중」처럼 못 적으면 null.",
          "- applyUrl: 실제로 신청서를 작성·제출하는 페이지. 목록에 있는 URL 만 쓴다. 없으면 null.",
          "  공고 상세 페이지·목록 페이지는 신청 페이지가 아니다. '신청하기' '접수' '지원하기' 링크가 그것이다.",
          "- attachments: 공고문·모집요강·신청서 양식·제출 서식 파일 링크. 목록에 있는 URL 만, 최대 3개.",
          "- 요약에 없는 사실을 지어내지 않는다.",
        ],
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
        /**
         * 마감은 **형식이 맞는지 코드가 본다.** 「2026년 9월 중」은 문자열로는
         * 완벽하고, 스키마가 통과시키면 그대로 스냅샷·계획·기한 역산까지
         * 흘러간다. 못 읽는 값은 여기서 버린다 — 없는 편이 틀린 것보다 낫다.
         */
        verify: [isoDate("deadline")],
        normalize: (raw, issues) => ({
          title: raw.title?.trim() ?? "",
          organization: raw.organization?.trim() || null,
          // 못 읽는 마감은 없는 것으로 둔다. 틀린 날짜로 기한을 역산하는 것보다
          // 「확인 안 됨」이 정직하고, 계획 에이전트도 그렇게 쓰게 돼 있다.
          deadline: dropped(issues, "deadline") ? null : raw.deadline?.trim() || null,
          applyUrl:
            raw.applyUrl && allowed.has(raw.applyUrl) ? raw.applyUrl : fallback.applyUrl,
          attachments: (raw.attachments ?? [])
            .filter((url) => allowed.has(url))
            .slice(0, 3),
        }),
      },
    );
    return value;
  } catch (error) {
    if (isAbort(error)) throw error;
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

/**
 * ⚠ `label` 이 **필수였다.** 항목 스무 개 중 하나에 라벨이 빠지면 zod 가 배열
 * 전체를 폐기하고 평문 폴백으로 떨어진다 — 하나 때문에 열아홉을 버리는 것이다.
 * 느슨하게 받고 `makeNeed` 가 빈 라벨을 거른다(그 함수는 원래 그 일을 한다).
 */
const needsSchema = z.object({
  needs: z
    .array(
      z.object({
        label: z.string().nullish(),
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
async function deriveNeeds(
  markdown: string,
  applyPage: Page | null,
  ctx: Ctx,
): Promise<Need[]> {
  const source: Need["source"] = applyPage ? "research" : "summary";
  try {
    const { value } = await runObject(
      { task: "research", log: ctx.log, signal: ctx.signal },
      {
        role: "너는 공고를 읽고 신청자가 직접 입력해야 하는 항목을 정리하는 설계자다.",
        schema: needsSchema,
        rules: [...NEED_RULES, "- 공고에 없는 항목을 지어내지 않는다. 최대 20개."],
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
        // 예시 값이 항목으로 올라오는 것과 같은 걸 두 번 묻는 것.
        // 둘 다 `makeNeed` 가 이미 거르지만, 여기서 세면 무엇이 걸렸는지 로그에 남는다.
        verify: [
          noPlaceholder("needs[].label"),
          uniqueBy("needs[].label", (item) => normalizeKey(String(item ?? ""))),
        ],
        normalize: (raw) =>
          (raw.needs ?? [])
            .map((item) =>
              makeNeed({
                label: item.label ?? "",
                kind: item.kind,
                options: item.options,
                required: item.required,
                why: item.why,
                source,
              }),
            )
            .filter((need): need is Need => need !== null)
            .slice(0, 20),
      },
    );
    return value;
  } catch (error) {
    if (isAbort(error)) throw error;
    // 모델이 실패하면 폼 라벨이라도 그대로 항목으로 만든다.
    return (applyPage?.formHints ?? [])
      .map((hint) => makeNeed({ label: hint, source }))
      .filter((need): need is Need => need !== null);
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
