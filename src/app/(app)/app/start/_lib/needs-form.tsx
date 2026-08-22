"use client";

import { useState } from "react";
import { Brain, FileUp, HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { Need } from "./types";

/**
 * 6~8 단계 화면 — 지식베이스로 못 채운 것만 묻는다.
 *
 * 채워진 항목도 보여주되 접어 둔다. 무엇이 자동으로 채워졌는지 보여야 사용자가
 * 틀린 값을 잡을 수 있다 — 숨기면 에이전트가 틀린 값을 제출한다.
 */
export function NeedsForm({
  needs,
  onSubmit,
}: {
  needs: Need[];
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
            직접 준비해 제출할 서류 {files.length}개
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            파일 업로드는 에이전트가 대신 못 한다. 신청 화면에서 업로드 차례가 오면
            조작권을 넘긴다.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {files.map((need) => (
              <li key={need.key} className="rounded-lg bg-muted/40 px-3 py-2">
                {need.label}
                {need.why && (
                  <span className="ml-2 text-xs text-muted-foreground">— {need.why}</span>
                )}
              </li>
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
