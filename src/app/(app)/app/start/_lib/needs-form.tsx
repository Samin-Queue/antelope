"use client";

import { useRef, useState } from "react";
import { Brain, Check, FileUp, HelpCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { Artifact, Need } from "./types";

/**
 * 항목을 갈라 센다. 화면 세 곳이 같은 숫자를 써야 해서 — 드로어 머리말,
 * 폼 본문, 고정 푸터 — 세는 자리를 하나로 둔다. 세 곳이 각자 세면 어긋난다.
 */
export function summarizeNeeds(needs: Need[], values: Record<string, string>) {
  const files = needs.filter((need) => need.kind === "file");
  const askable = needs.filter((need) => need.kind !== "file");
  const filled = askable.filter((need) => need.from === "memory");
  const missing = askable.filter((need) => need.from !== "memory");
  const missingRequired = missing.filter(
    (need) => need.required && !values[need.key]?.trim(),
  ).length;
  return { files, filled, missing, missingRequired };
}

/**
 * 6~8 단계 화면 — 지식베이스로 못 채운 것만 묻는다.
 *
 * 채워진 항목도 보여주되 접어 둔다. 무엇이 자동으로 채워졌는지 보여야 사용자가
 * 틀린 값을 잡을 수 있다 — 숨기면 에이전트가 틀린 값을 제출한다.
 *
 * 제출 버튼은 여기 없다. 드로어 푸터에 고정되어 스크롤과 무관하게 늘 보인다 —
 * 항목이 스무 개 넘어가면 버튼이 화면 밖으로 밀려 「다음은 뭘 눌러야 하나」가 된다.
 */
export function NeedsForm({
  needs,
  values,
  onChange,
  artifacts,
  runId,
  sourceNotice,
  onUpload,
}: {
  needs: Need[];
  /**
   * 입력값은 부모가 쥔다. 이 폼은 Drawer 안에 있어서 닫히면 언마운트되는데,
   * 값을 여기 두면 그때 통째로 사라진다 — 실제로 제출이 한 번 실패하면
   * 사용자가 친 것이 전부 날아갔다.
   */
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** 이미 준비된 파일 — 에이전트가 썼거나 보관함에서 꺼낸 것 */
  artifacts: Artifact[];
  /** 이번 실행 폴더. 올린 파일이 같은 곳으로 가야 브라우저가 첨부한다 */
  runId: string | null;
  sourceNotice: string;
  onUpload: (artifact: Artifact) => void;
}) {
  const [showFilled, setShowFilled] = useState(false);
  const { files, filled, missing } = summarizeNeeds(needs, values);

  return (
    <section>
      <h2 className="text-sm font-medium">직접 입력이 필요한 항목 {missing.length}개</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {filled.length > 0
          ? `${filled.length}개는 지식베이스에서 채웠다. 나머지만 확인하면 에이전트가 이어서 신청한다.`
          : "지식베이스에 아직 아는 값이 없다. 한 번 입력하면 다음 공고부터는 묻지 않는다."}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {missing.map((need) => (
          <Field
            key={need.key}
            need={need}
            value={values[need.key] ?? ""}
            onChange={onChange}
          />
        ))}
      </div>

      {filled.length > 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4">
          <button
            type="button"
            onClick={() => setShowFilled((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-medium text-brand"
          >
            <Brain className="size-3.5" />
            지식베이스에서 채운 {filled.length}개 {showFilled ? "접기" : "펼쳐서 확인"}
          </button>
          {showFilled && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {filled.map((need) => (
                <Field
                  key={need.key}
                  need={need}
                  value={values[need.key] ?? ""}
                  onChange={onChange}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="flex items-center gap-1.5 text-xs font-medium">
            <FileUp className="size-3.5" />
            제출 서류 {files.length}개
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            한 번 올린 발급 서류는 보관함에 남는다 — 다음 공고에서 다시 묻지 않는다.
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {files.map((need) => (
              <DocumentRow
                key={need.key}
                need={need}
                ready={artifacts.find((item) => item.needKey === need.key) ?? null}
                runId={runId}
                sourceNotice={sourceNotice}
                onUpload={onUpload}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const FROM_LABEL: Record<Artifact["from"], string> = {
  agent: "에이전트가 작성",
  memory: "보관함",
  user: "직접 올림",
};

/** 서류 한 줄 — 준비됐으면 그 사실을, 아니면 올릴 자리를 보여준다. */
function DocumentRow({
  need,
  ready,
  runId,
  sourceNotice,
  onUpload,
}: {
  need: Need;
  ready: Artifact | null;
  runId: string | null;
  sourceNotice: string;
  onUpload: (artifact: Artifact) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 이번 신청에는 붙지만 보관함에는 안 남았다 — 로그인 전이라 남길 곳이 없다 */
  const [unsaved, setUnsaved] = useState(false);

  async function send(file: File) {
    if (!runId) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("label", need.label);
      body.append("needKey", need.key);
      body.append("runId", runId);
      body.append("sourceNotice", sourceNotice);
      const response = await fetch("/app/start/documents", { method: "POST", body });
      const json = (await response.json()) as {
        artifact?: Artifact;
        stored?: boolean;
        error?: string;
      };
      if (!response.ok || !json.artifact) throw new Error(json.error ?? "업로드 실패");
      setUnsaved(json.stored === false);
      onUpload(json.artifact);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg bg-muted/40 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {ready ? (
          <Check className="size-3.5 shrink-0 text-brand" />
        ) : (
          <span className="size-3.5 shrink-0 rounded-full border border-dashed border-muted-foreground/50" />
        )}
        <span>{need.label}</span>
        {ready ? (
          <>
            <span className="truncate text-xs text-muted-foreground">
              {ready.filename}
            </span>
            <span className="text-xs text-brand">{FROM_LABEL[ready.from]}</span>
          </>
        ) : (
          <>
            {need.why && (
              <span className="truncate text-xs text-muted-foreground">— {need.why}</span>
            )}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void send(file);
              }}
            />
            <Button
              variant="outline"
              size="xs"
              className="ml-auto"
              disabled={busy || !runId}
              onClick={() => inputRef.current?.click()}
            >
              {busy && <Loader2 className="animate-spin" />}
              올리기
            </Button>
          </>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {unsaved && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          이번 신청에는 붙지만 보관함에는 안 남았다 — 로그인하면 다음 공고에서 다시 묻지
          않는다.
        </p>
      )}
    </li>
  );
}

function Field({
  need,
  value,
  onChange,
}: {
  need: Need;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  const long = need.kind === "long";
  return (
    <label className={long ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <span className="flex items-center gap-1.5 text-xs">
        {need.label}
        {need.required && <span className="text-brand">*</span>}
        {need.from === "memory" && (
          <span className="text-[10px] text-brand">
            기억함{need.memoryLabel ? ` (${need.memoryLabel})` : ""}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {need.source}
        </span>
      </span>
      {/* 정규화된 항목은 정규화된 UI 로 받는다. 「예 / 아니오」 를 글자로 치게
          하면 「Y」·「있음」·「해당없음」 이 섞여 들어와 폼에 못 넣는다. */}
      {long ? (
        <Textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(need.key, event.target.value)}
        />
      ) : need.kind === "checkbox" ? (
        <Choice
          options={["예", "아니오"]}
          value={value}
          onChange={(next) => onChange(need.key, next)}
        />
      ) : need.kind === "select" && need.options?.length ? (
        <Choice
          options={need.options}
          value={value}
          onChange={(next) => onChange(need.key, next)}
        />
      ) : (
        <Input
          type={
            need.kind === "date" ? "date" : need.kind === "number" ? "number" : "text"
          }
          value={value}
          // 선택지를 못 뽑은 select 는 자유 입력으로 떨어진다. 고를 것이 없는데
          // 고르라고 하는 것보다 낫다.
          placeholder={need.kind === "select" ? "직접 입력" : ""}
          onChange={(event) => onChange(need.key, event.target.value)}
        />
      )}
      {need.why && (
        <span className="flex items-start gap-1 text-[11px] text-muted-foreground">
          <HelpCircle className="mt-px size-3 shrink-0" />
          {need.why}
        </span>
      )}
    </label>
  );
}

/** 선택지를 눌러 고른다. 다시 누르면 해제된다 — 잘못 고르고 못 무르면 안 된다 */
function Choice({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.slice(0, 12).map((option) => {
        const picked = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(picked ? "" : option)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              picked
                ? "border-brand bg-brand/15 text-foreground"
                : "border-border text-muted-foreground hover:border-brand/40 hover:text-foreground",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
