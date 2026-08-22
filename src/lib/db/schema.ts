import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// better-auth 테이블(user·session·account·verification). drizzleAdapter 가
// schema 객체에서 이 이름들을 찾는다.
export * from "./auth-schema";

/** Upstage solar-embedding-2-* 의 출력 차원. */
export const EMBEDDING_DIM = 1024;

/**
 * 트랙 확정 전까지의 최소 스키마.
 * 도메인 테이블은 8/21 20:00 이후 여기에 추가한다.
 */
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  sourceUrl: text("source_url"),
  /** Upstage Document Parse 등 파서 원본 출력 */
  raw: jsonb("raw"),
  /** 파서에서 추출한 평문 */
  content: text("content"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 검색이 필요해질 때 쓰는 청크 테이블. 지금은 비어 있어도 무해하다.
 * pgvector 는 로컬·프로덕션 모두 0.8.6 으로 활성화되어 있다
 * (`CREATE EXTENSION IF NOT EXISTS vector`).
 */
export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    /** 문서 내 순서 */
    ordinal: integer("ordinal").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // 코사인 거리 기준 HNSW. Upstage 임베딩은 정규화되어 있어 코사인이 맞다.
    index("document_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("document_chunks_document_idx").on(table.documentId),
  ],
);

export type ApplicationField = {
  readonly key: string;
  readonly label: string;
  readonly inputType: string;
  readonly required: boolean;
  readonly stage: string;
  readonly documentName: string;
  readonly formName: string;
  readonly instructions: string;
  readonly source: string;
};

export const applicationForms = pgTable(
  "application_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    applicationType: text("application_type").notNull(),
    title: text("title").notNull(),
    fields: jsonb("fields").$type<readonly ApplicationField[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("application_forms_document_idx").on(table.documentId)],
);

export const crawlRuns = pgTable("crawl_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const opportunityCards = pgTable(
  "opportunity_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlRunId: uuid("crawl_run_id").references(() => crawlRuns.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(),
    source: text("source").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    content: text("content").notNull(),
    screenshot: text("screenshot").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("opportunity_cards_category_idx").on(table.category, table.capturedAt),
  ],
);

/**
 * 기업 지식베이스 — 이 제품의 해자.
 *
 * 신청 한 번에 입력한 정보를 버리지 않는다. 사업자 정보 같은 사실뿐 아니라
 * 아이템 설명·강점·과거에 쓴 사업계획 문장까지 쌓아, 다음 공고에서 AI 가
 * 먼저 꺼내 쓴다. 쓸수록 벌어지므로 경쟁자가 따라오기 어렵다.
 */
export const memoryKind = pgEnum("memory_kind", [
  /** 변하지 않는 사실 — 생년월일, 사업자번호, 창업일 */
  "fact",
  /** 아이템·제품·기능 서술 */
  "item",
  /** 강점·실적·수상 */
  "strength",
  /** 과거에 실제로 쓴 사업계획서 문장 */
  "narrative",
]);

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 소유자. better-auth user.id 는 text 다 */
    userId: text("user_id").notNull(),
    kind: memoryKind("kind").notNull().default("fact"),
    /** 사람이 읽는 이름. fact 면 질문 항목명과 같다 (예: 생년월일) */
    label: text("label").notNull(),
    value: text("value").notNull(),
    /** 어느 공고에서 얻었는지 — 출처를 잃으면 신뢰할 수 없다 */
    sourceNotice: text("source_notice"),
    /**
     * 항목명만 임베딩한 벡터. 다음 공고가 다른 말로 물어도 찾기 위한 것이다.
     * 값을 섞으면 의미가 흐려진다 — "상시근로자 수 ↔ 현재 직원 수" 유사도가
     * 값 포함 0.526, 라벨만 0.578 로 실측됐다.
     */
    labelEmbedding: vector("label_embedding", { dimensions: EMBEDDING_DIM }),
    /** 내용까지 담은 벡터. 사업계획 작성에 쓸 서술을 꺼낼 때 쓴다 */
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    /** 같은 label 이 갱신되면 이전 것을 밀어낸다 */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("memories_user_idx").on(table.userId),
    index("memories_user_label_idx").on(table.userId, table.label),
    index("memories_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("memories_label_embedding_idx").using(
      "hnsw",
      table.labelEmbedding.op("vector_cosine_ops"),
    ),
  ],
);

/** 목표 하나 = 세션 하나. 지난 목표 탭이 이걸 읽는다. */
export const goalStage = pgEnum("goal_stage", [
  "reviewing", // 검토 중 — 공고를 읽고 자격을 따지는 단계
  "working", // 작업 중 — 서류·신청서를 만드는 단계
  "waiting", // 결과 대기 중 — 제출하고 발표를 기다리는 단계
  "closed", // 종료됨
]);

export const goalOutcome = pgEnum("goal_outcome", [
  "won", // 선정
  "rejected", // 미선정
  "ineligible", // 자격 미달로 신청 못 함
  "deferred", // 나중에
  "abandoned", // 접음
]);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    organization: text("organization"),
    deadline: text("deadline"),
    stage: goalStage("stage").notNull().default("reviewing"),
    /** 아직 끝나지 않았으면 null */
    outcome: goalOutcome("outcome"),
    /** 정규화된 공고 객체와 파이프라인 결과 원본 */
    notice: jsonb("notice"),
    result: jsonb("result"),
    /**
     * 세션 스냅샷 — 요약·수집 파일·마스터 테이블.
     *
     * 이게 없으면 새로고침 한 번에 준비한 것이 전부 사라진다. 브라우저·파일
     * 에이전트가 읽는 **단일 진실**이라 값이 바뀔 때마다 여기를 갱신한다.
     * 모양은 `app/start/_lib/types.ts` 의 `SessionSnapshot`.
     */
    snapshot: jsonb("snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("goals_user_idx").on(table.userId, table.updatedAt)],
);

/**
 * 재사용하는 제출 서류.
 *
 * 사업자등록증·4대보험 명부·재무제표는 공고마다 똑같은 것을 낸다. 한 번 올린
 * 것을 다음 공고에서 다시 달라고 하면, 이 제품이 파는 「다시 묻지 않는다」가
 * 값에만 해당하고 파일에는 해당하지 않는 셈이 된다.
 *
 * 바이트를 base64 로 담는다. `bytea` 가 더 알뜰하지만 drizzle 에 기본 타입이
 * 없어 customType 을 얹어야 하고, 서류 한 장은 대개 1MB 미만이라 TOAST 압축으로
 * 충분하다. 상한은 애플리케이션에서 막는다.
 */
export const userDocuments = pgTable(
  "user_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    /** 사람이 읽는 서류 이름 — 「사업자등록증 사본」 */
    label: text("label").notNull(),
    /** 조회 키. 공백·「사본」 같은 접미어를 턴 것 */
    matchKey: text("match_key").notNull(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    /** base64 */
    data: text("data").notNull(),
    /** 어느 공고에서 올렸는지 — 출처를 잃으면 신뢰할 수 없다 */
    sourceNotice: text("source_notice"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("user_documents_key_idx").on(table.userId, table.matchKey)],
);

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ────────────────────────────────────────────────────────────────────────────
 * 릴레이 — 슬랙·텔레그램에서 에이전트를 돌린다.
 *
 * 설계: docs/superpowers/plans/2026-08-22-relay-channels.md
 *
 * lab 규칙(「새 테이블 대신 documents.raw」)에서 의도적으로 벗어난다. 신원
 * 매핑에는 **유니크 제약**이, 멱등에는 **primary key** 가 곧 기능이라 jsonb
 * 한 칸으로는 성립하지 않는다 — 같은 사람이 두 번 연동하면 행이 둘이 되고
 * 그때 어느 쪽이 유효한지 코드가 알 수 없다.
 *
 * 실험을 접을 때는 `src/app/(labs)/lab/relay` · `src/app/api/relay` 와 함께
 * 이 블록을 지우고 relay_* 네 테이블을 drop 한다.
 * ──────────────────────────────────────────────────────────────────────────── */

export const relayChannel = pgEnum("relay_channel", ["slack", "telegram"]);

/**
 * 외부 계정 ↔ Antelope 사용자.
 *
 * **이게 없으면 실행하지 않는다.** 지식베이스(`memories`)가 사용자별이고,
 * 결과를 남길 `goals` 의 주인이 필요하고, 우리 LLM 키를 아무나 쓰면 안 된다.
 */
export const relayIdentities = pgTable(
  "relay_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    channel: relayChannel("channel").notNull(),
    /** 채널 안의 사용자 id. 슬랙 `U…`, 텔레그램은 숫자 */
    externalId: text("external_id").notNull(),
    /** 슬랙 team_id. 텔레그램은 null */
    workspaceId: text("workspace_id"),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // 같은 사람이 몇 번을 다시 연동해도 행은 하나다. 워크스페이스가 null 인
    // 채널(텔레그램)에서도 성립하도록 빈 문자열로 정규화해 넣는다.
    uniqueIndex("relay_identity_uniq").on(
      table.channel,
      table.externalId,
      table.workspaceId,
    ),
    index("relay_identity_user_idx").on(table.userId),
  ],
);

export const relayThreadStatus = pgEnum("relay_thread_status", [
  "queued", // 자리를 기다린다
  "running", // 준비 파이프라인이 돈다
  "asking", // 사람의 답을 기다린다
  "ready", // 준비 완료. 신청으로 넘어갈 수 있다
  "applying", // 신청이 돈다
  "done",
  "lost", // 서버 재시작으로 끊겼다
  "error",
]);

/**
 * 대화 한 줄기 = 실행 한 건.
 *
 * DB 에 남기는 것은 **재개에 필요한 것이 아니라 설명에 필요한 것**이다.
 * 파이프라인 중간 상태(Studio job·Chromium 세션·부분 요약)는 직렬화하지
 * 않는다 — 그 비용이 기능 전체보다 크다. 대신 재시작으로 죽었다는 사실을
 * 스레드가 알 수 있게 한다.
 */
export const relayThreads = pgTable(
  "relay_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    channel: relayChannel("channel").notNull(),
    /** 슬랙 channel id · 텔레그램 chat id */
    conversation: text("conversation").notNull(),
    /** 슬랙 thread_ts · 텔레그램은 최초 message_id */
    thread: text("thread").notNull(),
    /**
     * 스레드를 연 사람.
     *
     * 되묻기의 답은 **이 사람에게서만** 받는다. 지식베이스가 사용자별이라
     * 다른 사람의 값을 섞으면 남의 회사 정보가 이 신청서에 들어간다.
     */
    starterExternalId: text("starter_external_id").notNull(),
    status: relayThreadStatus("status").notNull().default("queued"),
    /** `goals.id` — 「이어서 하기」 링크와 결과 기록의 대상 */
    goalId: uuid("goal_id"),
    /** in-flight 실행의 runId. `run-registry` 의 열쇠 */
    runId: text("run_id"),
    /** 진행 표시줄로 쓰는 메시지. 새 댓글 대신 이걸 고쳐서 갱신한다 */
    progressMessageId: text("progress_message_id"),
    /** 지금 무엇을 묻고 있는가. 재시작을 넘기는 유일한 상태 */
    pendingNeeds: jsonb("pending_needs"),
    /** 마지막으로 스레드에 쓴 말. 화면에서 무슨 일이 있었는지 훑기 위한 것 */
    lastNote: text("last_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("relay_thread_uniq").on(table.channel, table.conversation, table.thread),
    index("relay_thread_user_idx").on(table.userId, table.updatedAt),
    index("relay_thread_status_idx").on(table.status),
  ],
);

/**
 * 멱등 키.
 *
 * 슬랙은 3초 안에 200 을 못 받으면 같은 이벤트를 다시 보낸다. 이 표가 없으면
 * 멘션 한 번이 신청 세 건이 된다 — Chromium 6개가 같이 뜬다는 뜻이다.
 */
export const relayEvents = pgTable("relay_events", {
  /** 슬랙 event_id · 텔레그램 update_id */
  id: text("id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});
