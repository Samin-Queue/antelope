"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * 자격 판정에 쓸 신청자 정보.
 * 비워두면 그 항목은 unknown 으로 떨어지고 에이전트가 되묻는다 — 그게 정상 동작이다.
 */
const FIELDS = [
  { key: "성명", placeholder: "김시윤" },
  { key: "생년월일", placeholder: "1999-04-12" },
  { key: "기업명", placeholder: "안텔로프" },
  { key: "창업일", placeholder: "2024-03-01" },
  { key: "업종", placeholder: "지식서비스업(소프트웨어 개발)" },
  { key: "매출", placeholder: "2025년 8천만원" },
  { key: "직원수", placeholder: "3명" },
] as const;

export function ProfileForm({
  onSubmit,
}: {
  onSubmit: (profile: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  const filled = Object.values(values).filter((value) => value.trim()).length;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-medium">신청자 정보</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        비워두면 그 항목은 「확인 필요」로 표시된다. 추측해서 판정하지 않는다.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="space-y-1.5">
            <span className="text-xs text-muted-foreground">{field.key}</span>
            <Input
              value={values[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
              }
            />
          </label>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={() => onSubmit(values)}>다음</Button>
        <span className="text-xs text-muted-foreground">
          {filled}/{FIELDS.length} 입력됨
        </span>
      </div>
    </section>
  );
}
