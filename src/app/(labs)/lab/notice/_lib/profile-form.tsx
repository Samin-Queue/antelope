"use client";

import { useEffect, useState } from "react";
import { HelpCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { RequiredField } from "./agents";
import type { Notice } from "./schema";

/**
 * 공고마다 묻는 것이 다르다.
 *
 * 고정 폼은 두 번 틀린다 — 안 쓰는 걸 묻고, 정작 필요한 걸 안 묻는다.
 * 공고를 이미 구조화해뒀으므로 필요한 항목을 거기서 도출한다.
 */
type Known = Record<string, { value: string; label: string }>;

export function ProfileForm({
  notice,
  onSubmit,
}: {
  notice: Notice;
  onSubmit: (profile: Record<string, string>) => void;
}) {
  const [fields, setFields] = useState<RequiredField[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [known, setKnown] = useState<Known>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/lab/notice/fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notice }),
        });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
        const derived = json.fields as RequiredField[];
        if (cancelled) return;
        setFields(derived);

        // 도출된 항목으로 지식베이스를 조회한다. 이미 아는 것은 채워서 보여준다.
        const recall = await fetch("/lab/notice/recall", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labels: derived.map((field) => field.key) }),
        });
        const recalled = (await recall.json()) as { known: Known };
        if (cancelled) return;
        setKnown(recalled.known ?? {});
        setValues((prev) => {
          const next = { ...prev };
          for (const [key, memory] of Object.entries(recalled.known ?? {})) {
            if (!next[key]) next[key] = memory.value;
          }
          return next;
        });
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notice]);

  if (error) {
    return (
      <p className="rounded-lg bg-destructive/10 px-4 py-3 font-mono text-xs text-destructive">
        {error}
      </p>
    );
  }

  if (!fields) {
    return (
      <section className="flex items-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-brand" />이 공고에 필요한 항목을
        고르는 중
      </section>
    );
  }

  const missingRequired = fields.filter(
    (field) => field.required && !values[field.key]?.trim(),
  ).length;
  const prefilled = fields.filter((field) => known[field.key]).length;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-medium">이 공고에 필요한 정보 {fields.length}개</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {prefilled > 0
          ? `${prefilled}개는 이미 알고 있어 채워뒀다. 나머지만 확인하면 된다.`
          : "공고의 자격 요건과 평가 배점에서 도출했다. 비워두면 「확인 필요」로 표시된다."}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label
            key={field.key}
            className={
              field.kind === "long" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"
            }
          >
            <span className="flex items-center gap-1.5 text-xs">
              {field.key}
              {field.required && <span className="text-brand">*</span>}
              {known[field.key] && <span className="text-[10px] text-brand">기억함</span>}
            </span>
            {field.kind === "long" ? (
              <Textarea
                rows={3}
                value={values[field.key] ?? ""}
                placeholder={field.placeholder ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              />
            ) : (
              <Input
                value={values[field.key] ?? ""}
                placeholder={field.placeholder ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              />
            )}
            {field.why && (
              <span className="flex items-start gap-1 text-[11px] text-muted-foreground">
                <HelpCircle className="mt-px size-3 shrink-0" />
                {field.why}
              </span>
            )}
          </label>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => onSubmit(values)}>다음</Button>
        <span className="text-xs text-muted-foreground">
          {missingRequired > 0 ? `필수 ${missingRequired}개 미입력` : "필수 항목 완료"}
        </span>
      </div>
    </section>
  );
}
