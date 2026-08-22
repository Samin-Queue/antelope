import { hasDb } from "@/lib/db";
import { env } from "@/lib/env";
import type { IntakeInput } from "@/app/(app)/app/start/_lib/intake";
import { runStart } from "@/app/(app)/app/start/_lib/pipeline";

import type { Incoming, RelayChannel } from "./channel";
import { acquire } from "./queue";
import { makeSink } from "./sink";
import { slackDisplayName } from "./slack";
import {
  consumeLinkCode,
  findIdentity,
  openThread,
  updateThread,
  type ThreadRow,
} from "./store";

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

/** 연동 코드 — `relay_link_codes` 의 알파벳과 같은 집합, 8자 */
const CODE = /\b([A-HJ-NP-Z2-9]{8})\b/;

const LINK_GUIDE = [
  "이 계정이 아직 Antelope 에 연결되어 있지 않습니다.",
  "",
  "1. Antelope 워크스페이스 → 설정 · 연동 에서 *슬랙 연동 코드*를 받으세요.",
  "2. 여기(봇과의 1:1 대화)에 그 코드를 그대로 보내면 연결됩니다.",
].join("\n");

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
  if (!identity) {
    await tryLink(channel, incoming);
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
    // Step 2 에서 여기가 답 배분으로 이어진다.
    await channel.post(
      incoming.ref,
      "지금은 답을 받아 이어가는 기능이 아직 붙지 않았습니다. " +
        `${appUrl()} 에서 마저 채워 주세요.`,
    );
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
  await updateThread(thread.id, {
    status: out.error ? "error" : out.ended === "ready" ? "ready" : "done",
    goalId: out.goalId,
    progressMessageId: sink.progressMessageId(),
    pendingNeeds: out.needs ?? null,
  });

  await channel.post(incoming.ref, closing(out, channel, incoming));
}

function closing(
  out: ReturnType<Sink["result"]>,
  channel: RelayChannel,
  incoming: Incoming,
): string {
  const link = out.goalId ? `\n${appUrl()} 에서 이어서 할 수 있습니다.` : "";
  if (out.error) return `⚠️ 준비를 마치지 못했습니다 — ${out.error}${link}`;

  if (out.ended === "stopped") {
    return `여기서 멈췄습니다${out.detail ? ` — ${out.detail}` : ""}.${link}`;
  }
  if (out.ended !== "ready") {
    /**
     * `end` 를 못 받았다.
     *
     * 파이프라인의 모든 종료 경로가 `end` 를 보내게 돼 있으므로(`types.ts:255-262`),
     * 여기 오는 것은 그 약속이 깨졌다는 뜻이다. 조용히 넘기지 않는다.
     */
    return `준비가 끝났는지 확실하지 않습니다. 서버 로그를 봐야 합니다.${link}`;
  }

  const missing = (out.needs ?? []).filter(
    (need) => need.kind !== "file" && !need.value?.trim(),
  );
  const head = `✅ ${out.title ?? "공고"} 준비를 마쳤습니다.`;

  if (missing.length === 0 && out.applyUrl) {
    return `${head}\n빈 항목이 없어 바로 신청할 수 있습니다 — 신청 실행은 아직 화면 몫입니다.${link}`;
  }
  if (missing.length === 0) {
    return `${head}\n신청 페이지 주소를 찾지 못했습니다. 링크를 알려주시면 이어갑니다.${link}`;
  }
  const list = missing
    .slice(0, 10)
    .map((need, i) => `${i + 1}. ${need.label}`)
    .join("\n");
  return (
    `${head}\n${channel.mention(incoming.from)} 아직 ${missing.length}가지가 비어 있습니다.\n${list}` +
    (missing.length > 10 ? `\n… 외 ${missing.length - 10}건` : "") +
    `\n\n이 스레드에서 답을 받아 이어가는 것은 다음 단계입니다.${link}`
  );
}

type Sink = ReturnType<typeof makeSink>;

/**
 * 연동.
 *
 * **1:1 대화에서만 받는다.** 공개 채널에 적힌 코드는 그것을 먼저 본 사람이
 * 써서 남의 계정에 자기 슬랙 id 를 붙일 수 있다.
 */
async function tryLink(channel: RelayChannel, incoming: Incoming): Promise<void> {
  const match = incoming.isDirect ? CODE.exec(incoming.text) : null;
  if (!match) {
    await channel.post(incoming.ref, LINK_GUIDE);
    return;
  }

  const result = await consumeLinkCode(match[1], {
    channel: channel.id,
    externalId: incoming.from,
    workspaceId: incoming.ref.workspaceId,
    displayName:
      incoming.displayName ??
      (channel.id === "slack" ? await slackDisplayName(incoming.from) : null),
  });

  if (result.ok) {
    await channel.post(
      incoming.ref,
      "연결됐습니다. 이제 공고 링크나 원하는 것을 보내면 여기서 바로 준비를 시작합니다.",
    );
    return;
  }

  // 만료와 재사용을 구분해 말한다. 뭉치면 코드를 다시 받을 생각을 못 한다.
  const why = {
    unknown: "그런 코드가 없습니다. 설정 · 연동 에서 다시 받아 주세요.",
    expired: "코드가 만료됐습니다(10분). 설정 · 연동 에서 다시 받아 주세요.",
    used: "이미 사용된 코드입니다. 설정 · 연동 에서 새로 받아 주세요.",
  }[result.why];
  await channel.post(incoming.ref, why);
}
