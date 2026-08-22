import { hasDb } from "@/lib/db";

import type { Incoming, RelayChannel } from "./channel";
import { slackDisplayName } from "./slack";
import { consumeLinkCode, findIdentity, openThread, updateThread } from "./store";

/**
 * 실행 호스트 — 채널에서 들어온 말 하나를 처리한다.
 *
 * **웹훅 응답 밖에서 돈다.** 슬랙은 3초 안에 200 을 못 받으면 같은 이벤트를
 * 다시 보내고, 우리 파이프라인은 분 단위다. 라우트는 검증·멱등까지만 하고
 * 여기로 넘긴다.
 *
 * ⚠ 이 파일은 `runStart` 를 부르는 **유일한 자리**가 된다(Step 1). 준비
 * 파이프라인의 시그니처가 개편으로 바뀌어도 고칠 곳이 여기 한 줄이 되도록
 * 다른 곳에서 부르지 않는다.
 */

/** 연동 코드 — `relay_link_codes` 의 알파벳과 같은 집합, 8자 */
const CODE = /\b([A-HJ-NP-Z2-9]{8})\b/;

const LINK_GUIDE = [
  "이 계정이 아직 Antelope 에 연결되어 있지 않습니다.",
  "",
  "1. Antelope 워크스페이스 → 설정 · 연동 에서 *슬랙 연동 코드*를 받으세요.",
  "2. 여기(봇과의 1:1 대화)에 그 코드를 그대로 보내면 연결됩니다.",
].join("\n");

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
   * 지식베이스(`memories`)가 사용자별이라, 끼어든 사람의 값을 섞으면 남의
   * 회사 정보가 이 신청서에 들어간다.
   */
  if (thread.starterExternalId !== incoming.from) {
    await channel.post(
      incoming.ref,
      `이 작업은 ${channel.mention(thread.starterExternalId)} 님이 시작했습니다. 값은 그분에게서만 받습니다.`,
    );
    return;
  }

  // Step 1 에서 여기가 `runStart` 로 이어진다. 지금은 왕복이 되는지만 본다.
  const note = incoming.text.trim() || "(내용 없음)";
  const files = incoming.files.length
    ? `\n첨부 ${incoming.files.length}개: ${incoming.files.map((f) => f.name).join(", ")}`
    : "";
  await channel.post(
    incoming.ref,
    `받았습니다 — ${note.slice(0, 300)}${files}\n\n_아직 준비 파이프라인은 붙지 않았습니다 (Step 1)._`,
  );
  await updateThread(thread.id, { lastNote: note.slice(0, 500) });
}

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
      "연결됐습니다. 이제 공고 링크나 파일을 보내면 여기서 바로 준비를 시작합니다.",
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
