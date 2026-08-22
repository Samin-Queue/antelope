import { hasDb } from "@/lib/db";
import { env } from "@/lib/env";
import type { IntakeInput } from "@/app/(app)/app/start/_lib/intake";
import { runStart } from "@/app/(app)/app/start/_lib/pipeline";
import { saveNeeds } from "@/app/(app)/app/start/_lib/session";
import type { Need } from "@/app/(app)/app/start/_lib/types";
import { remember } from "@/app/(labs)/lab/notice/_lib/memory";

import { applyAnswers, missingOf, parseAnswers } from "./answers";
import type { Incoming, RelayChannel } from "./channel";
import { acquire } from "./queue";
import { makeSink } from "./sink";
import { findIdentity, openThread, updateThread, type ThreadRow } from "./store";

/**
 * 실행 호스트 — 채널에서 들어온 말 하나를 처리한다.
 *
 * **웹훅 응답 밖에서 돈다.** 슬랙은 3초 안에 200 을 못 받으면 같은 이벤트를
 * 다시 보내고, 우리 파이프라인은 분 단위다. 라우트는 검증·멱등까지만 하고
 * 여기로 넘긴다.
 *
 * ⚠ **`runStart` 를 부르는 유일한 자리다.** LLM 계층 개편이 그 시그니처를
 * 바꿔도 고칠 곳이 아래 한 줄이 되도록 다른 곳에서 부르지 않는다.
 */

function appUrl(path = "/app"): string {
  const base = (env.BETTER_AUTH_URL || "https://antelope.up.railway.app").replace(
    /\/+$/,
    "",
  );
  return `${base}${path}`;
}

/**
 * 한 통의 말을 파이프라인 입력으로 바꾼다.
 *
 * 링크와 문장을 **둘 다** 넘긴다 — `intake` 가 셋(file·url·text)을 함께 받도록
 * 돼 있고(`run/route.ts` 도 그렇게 보낸다), 「이 공고 우리 회사로 신청해줘」 같은
 * 문장이 의도로 그대로 쓰인다.
 */
export function toInput(text: string): IntakeInput {
  const url = text.match(/https?:\/\/[^\s<>|]+/)?.[0];
  const rest = (url ? text.replace(url, " ") : text).replace(/\s+/g, " ").trim();
  const input: IntakeInput = {};
  if (url) input.url = url;
  if (rest) input.text = rest;
  return input;
}

export async function handle(channel: RelayChannel, incoming: Incoming): Promise<void> {
  if (!hasDb()) {
    await channel.post(
      incoming.ref,
      "데이터베이스가 연결되어 있지 않아 진행할 수 없습니다.",
    );
    return;
  }

  const identity = await findIdentity(
    channel.id,
    incoming.from,
    incoming.ref.workspaceId,
  );

  /**
   * 연결은 **동의 화면 한 번**이다. 코드를 손으로 옮기게 하거나 이메일이 같기를
   * 바라지 않는다 — 어느 슬랙 계정을 잇는지는 사용자가 그 화면에서 직접 고른다.
   * 링크는 공개돼도 무해하다. 로그인한 사람만 열 수 있다.
   */
  if (!identity) {
    await channel.post(
      incoming.ref,
      `${channel.mention(incoming.from)} 이 슬랙 계정이 아직 Antelope 에 연결되어 있지 않습니다.\n${appUrl("/app/settings")} 에서 「슬랙 연결」을 한 번 누르면 됩니다.`,
    );
    return;
  }

  const thread = await openThread({
    ref: incoming.ref,
    userId: identity.userId,
    starterExternalId: incoming.from,
  });

  /**
   * 답은 스레드를 연 사람에게서만 받는다.
   *
   * 지식베이스(`memories`)가 사용자별이라, 끼어든 사람의 값을 섞으면 남의 회사
   * 정보가 이 신청서에 들어간다.
   */
  if (thread.starterExternalId !== incoming.from) {
    await channel.post(
      incoming.ref,
      `이 작업은 ${channel.mention(thread.starterExternalId)} 님이 시작했습니다. 값은 그분에게서만 받습니다.`,
    );
    return;
  }

  if (thread.status === "running" || thread.status === "applying") {
    await channel.post(incoming.ref, "이미 진행 중입니다. 끝나면 여기에 씁니다.");
    return;
  }
  if (thread.status === "asking") {
    await absorb(channel, incoming, thread);
    return;
  }

  const input = toInput(incoming.text);
  if (!input.url && !input.text) {
    await channel.post(
      incoming.ref,
      "공고 링크나 원하는 것을 한 줄로 적어 주세요. (파일 첨부는 아직입니다 — Step 3)",
    );
    return;
  }

  await prepare(channel, incoming, thread, identity.userId, input);
}

/** 1~5단계 준비. 신청은 아직 이 화면 몫이 아니다(Step 5) */
async function prepare(
  channel: RelayChannel,
  incoming: Incoming,
  thread: ThreadRow,
  userId: string,
  input: IntakeInput,
): Promise<void> {
  const slot = await acquire(userId, (ahead) => {
    void channel.post(
      incoming.ref,
      `앞에 ${ahead}건이 있어 차례를 기다립니다. 자리가 나면 시작합니다.`,
    );
  });
  if (!slot.ok) {
    await channel.post(
      incoming.ref,
      slot.why === "busy"
        ? "이미 다른 작업이 돌고 있습니다. 그것이 끝난 뒤에 다시 불러 주세요."
        : "대기가 너무 길어져 접었습니다. 잠시 뒤 다시 불러 주세요.",
    );
    return;
  }

  const sink = makeSink(channel, incoming.ref);
  await updateThread(thread.id, {
    status: "running",
    lastNote: incoming.text.slice(0, 500),
  });

  try {
    // ★ 개편이 시그니처를 바꾸면 고칠 곳은 이 한 줄이다.
    await runStart(input, sink.emit, { userId });
  } catch (error) {
    sink.emit({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("[relay/host] 준비 실패", error);
  } finally {
    slot.release();
    await sink.flush();
  }

  const out = sink.result();
  const needs = (out.needs ?? []) as Need[];
  const missing = missingOf(needs);
  /**
   * 빈 항목이 있으면 **스레드가 계속 열려 있다.** 답은 여기서 받는다 —
   * `asking` 이 그 상태이고, `pendingNeeds` 가 「지금 무엇을 묻고 있는가」의
   * 단일 진실이라 서버가 재시작해도 그 뒤에 온 답이 같은 질문에 붙는다.
   */
  await updateThread(thread.id, {
    status: out.error ? "error" : missing.length ? "asking" : "ready",
    goalId: out.goalId,
    progressMessageId: sink.progressMessageId(),
    pendingNeeds: needs.length ? needs : null,
  });

  await channel.post(incoming.ref, closing(out, missing, channel, incoming));
}

/**
 * 사람이 쓴 답을 항목에 나눠 담고 이어간다.
 *
 * 채운 값은 두 곳에 남긴다 — 이번 세션(`goals.snapshot`)과 지식베이스(`memories`).
 * 후자가 이 제품이 파는 「다시 묻지 않는다」다.
 */
async function absorb(
  channel: RelayChannel,
  incoming: Incoming,
  thread: ThreadRow,
): Promise<void> {
  const needs = (thread.pendingNeeds ?? []) as Need[];
  if (!needs.length) {
    await updateThread(thread.id, { status: "ready" });
    await channel.post(
      incoming.ref,
      `무엇을 묻고 있었는지 잃었습니다. ${appUrl()} 에서 이어서 해주세요.`,
    );
    return;
  }

  const { filled, leftover } = await parseAnswers(
    needs,
    incoming.text,
    thread.runId ?? undefined,
  );
  if (Object.keys(filled).length === 0) {
    await channel.post(
      incoming.ref,
      leftover.length
        ? `어느 항목의 답인지 알 수 없었습니다: ${leftover.slice(0, 3).join(" / ")}\n번호나 항목 이름을 같이 적어 주세요.`
        : "답을 알아듣지 못했습니다. 「기업명은 …, 총사업비는 …」처럼 항목 이름과 함께 적어 주세요.",
    );
    return;
  }

  const next = applyAnswers(needs, filled);
  const missing = missingOf(next);
  await updateThread(thread.id, {
    status: missing.length ? "asking" : "ready",
    pendingNeeds: next,
  });

  // 이번 세션에 반영한다. 실패해도 대화는 이어간다.
  if (thread.goalId) void saveNeeds(thread.userId, thread.goalId, next);
  // 다음 공고에서 다시 묻지 않기 위한 것. 이게 이 제품의 해자다.
  void remember(
    thread.userId,
    Object.entries(filled).map(([label, value]) => ({
      kind: value.length > 60 ? ("narrative" as const) : ("fact" as const),
      label,
      value,
    })),
  ).catch((error) => console.error("[relay/absorb] 기억 저장 실패", error));

  const took = Object.entries(filled)
    .map(([label, value]) => `· ${label} — ${value.slice(0, 60)}`)
    .join("\n");

  if (missing.length === 0) {
    await channel.post(
      incoming.ref,
      `받았습니다.\n${took}\n\n✅ 필요한 값이 모두 모였습니다. ${appUrl()} 에서 신청을 실행할 수 있습니다.`,
    );
    return;
  }
  await channel.post(
    incoming.ref,
    `받았습니다.\n${took}\n\n${askText(missing, channel, incoming)}` +
      (leftover.length
        ? `\n\n(이건 어느 항목인지 몰라 남겨 뒀습니다: ${leftover.slice(0, 2).join(" / ")})`
        : ""),
  );
}

/** 무엇이 비었는지 묻는 말. 준비 직후와 답을 받은 뒤 같은 글로 묻는다 */
function askText(missing: Need[], channel: RelayChannel, incoming: Incoming): string {
  const list = missing
    .slice(0, 10)
    .map(
      (need, i) =>
        `${i + 1}. ${need.label}${need.options?.length ? ` (${need.options.slice(0, 4).join(" / ")})` : ""}`,
    )
    .join("\n");
  return (
    `${channel.mention(incoming.from)} 아직 ${missing.length}가지가 비어 있습니다.\n${list}` +
    (missing.length > 10 ? `\n… 외 ${missing.length - 10}건` : "") +
    "\n\n이 스레드에 답장으로 적어 주세요. 「기업명은 …, 총사업비는 …」처럼 한 번에 적어도 됩니다."
  );
}

function closing(
  out: ReturnType<Sink["result"]>,
  missing: Need[],
  channel: RelayChannel,
  incoming: Incoming,
): string {
  const link = out.goalId ? `\n${appUrl()} 에서도 이어서 할 수 있습니다.` : "";
  if (out.error) return `⚠️ 준비를 마치지 못했습니다 — ${out.error}${link}`;

  if (out.ended === "stopped") {
    return `여기서 멈췄습니다${out.detail ? ` — ${out.detail}` : ""}.${link}`;
  }
  if (out.ended !== "ready") {
    /**
     * `end` 를 못 받았다. 파이프라인의 모든 종료 경로가 그것을 보내게 돼 있으므로
     * (`types.ts` 의 `end` 주석), 여기 오는 것은 그 약속이 깨졌다는 뜻이다.
     */
    return `준비가 끝났는지 확실하지 않습니다. 서버 로그를 봐야 합니다.${link}`;
  }

  const head = `✅ ${out.title ?? "공고"} 준비를 마쳤습니다.`;
  if (missing.length === 0 && out.applyUrl) {
    return `${head}\n빈 항목이 없습니다. ${appUrl()} 에서 신청을 실행할 수 있습니다.`;
  }
  if (missing.length === 0) {
    return `${head}\n신청 페이지 주소를 찾지 못했습니다. 링크를 알려주시면 이어갑니다.${link}`;
  }
  return `${head}\n${askText(missing, channel, incoming)}`;
}

type Sink = ReturnType<typeof makeSink>;
