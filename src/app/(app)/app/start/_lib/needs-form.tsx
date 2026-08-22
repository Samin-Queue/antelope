"use client";

import { useRef, useState } from "react";
import { Check, HelpCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { Artifact, Need } from "./types";

/**
 * 항목을 갈라 센다. 「필요한 정보」 탭과 푸터 버튼이 같은 숫자를 써야 해서
 * 세는 자리를 하나로 둔다. 두 곳이 각자 세면 「필수 0개」인데 버튼이 안
 * 넘어가는 일이 생긴다.
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

const FROM_LABEL: Record<Artifact["from"], string> = {
  agent: "에이전트가 작성",
  memory: "보관함",
  user: "직접 올림",
};

/** 서류 한 줄 — 준비됐으면 그 사실을, 아니면 올릴 자리를 보여준다. */
export function DocumentRow({
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

export function Field({
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
          {/*
            근거를 찾았는지 **그대로** 말한다.
            못 찾은 것을 안 보여 주면 화면 전체가 「전부 근거가 있다」로 읽힌다 —
            찾은 것에만 표를 다는 편이 정직하고, 그 차이가 이 제품이 파는 것이다.
          */}
          {need.evidenceIds?.length ? (
            <span
              className="ml-1 shrink-0 rounded-sm bg-brand/10 px-1 text-[10px] text-brand"
              title={`공고 원문 ${need.evidenceIds.length}곳에서 확인했다`}
            >
              원문 확인
            </span>
          ) : null}
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
