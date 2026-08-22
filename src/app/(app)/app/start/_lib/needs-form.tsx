"use client";

import { useRef, useState } from "react";
import { Brain, Check, FileUp, HelpCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { Artifact, Need } from "./types";

/**
 * 6~8 단계 화면 — 지식베이스로 못 채운 것만 묻는다.
 *
 * 채워진 항목도 보여주되 접어 둔다. 무엇이 자동으로 채워졌는지 보여야 사용자가
 * 틀린 값을 잡을 수 있다 — 숨기면 에이전트가 틀린 값을 제출한다.
 */
export function NeedsForm({
  needs,
  artifacts,
  runId,
  sourceNotice,
  onUpload,
  onSubmit,
}: {
  needs: Need[];
  /** 이미 준비된 파일 — 에이전트가 썼거나 보관함에서 꺼낸 것 */
  artifacts: Artifact[];
  /** 이번 실행 폴더. 올린 파일이 같은 곳으로 가야 브라우저가 첨부한다 */
  runId: string | null;
  sourceNotice: string;
  onUpload: (artifact: Artifact) => void;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(needs.filter((n) => n.value).map((n) => [n.key, n.value ?? ""])),
  );
  const [showFilled, setShowFilled] = useState(false);

  const files = needs.filter((need) => need.kind === "file");
  const askable = needs.filter((need) => need.kind !== "file");
  const filled = askable.filter((need) => need.from === "memory");
  const missing = askable.filter((need) => need.from !== "memory");
  const missingRequired = missing.filter(
    (need) => need.required && !values[need.key]?.trim(),
  ).length;

  const set = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
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
            onChange={set}
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
                  onChange={set}
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

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => onSubmit(values)} disabled={missingRequired > 0}>
          이 정보로 신청 진행
        </Button>
        <span className="text-xs text-muted-foreground">
          {missingRequired > 0 ? `필수 ${missingRequired}개 미입력` : "필수 항목 완료"}
        </span>
      </div>
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
      const json = (await response.json()) as { artifact?: Artifact; error?: string };
      if (!response.ok || !json.artifact) throw new Error(json.error ?? "업로드 실패");
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
      {long ? (
        <Textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(need.key, event.target.value)}
        />
      ) : (
        <Input
          type={
            need.kind === "date" ? "date" : need.kind === "number" ? "number" : "text"
          }
          value={value}
          placeholder={
            need.kind === "checkbox"
              ? "예 / 아니오"
              : need.kind === "select"
                ? "고를 항목"
                : ""
          }
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
