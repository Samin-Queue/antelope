"use client";

import { createContext, use, useMemo, useState } from "react";
import { Quote } from "lucide-react";

import { cn } from "@/lib/utils";

import { matchEvidence, pageCount, type Evidence } from "./evidence";

/**
 * 근거 하이라이트.
 *
 * 「이 값 어디서 나왔어?」에 좌표로 답한다. 값을 누르면 원문의 어느 블록에서
 * 나왔는지 페이지 위에 그린다. 못 찾으면 못 찾았다고 말한다 — 아무 데나
 * 칠하면 하이라이트가 근거인 척하는 장식이 된다.
 */
type Selection = { label: string; needle: string } | null;

const EvidenceContext = createContext<{
  selection: Selection;
  select: (value: Selection) => void;
  enabled: boolean;
}>({ selection: null, select: () => {}, enabled: false });

export function EvidenceProvider({
  evidence,
  children,
}: {
  evidence: Evidence[];
  children: React.ReactNode;
}) {
  const [selection, setSelection] = useState<Selection>(null);
  const enabled = evidence.length > 0;
  const value = useMemo(
    () => ({
      selection,
      select: (next: Selection) =>
        setSelection((prev) => (prev?.needle === next?.needle ? null : next)),
      enabled,
    }),
    [selection, enabled],
  );
  return <EvidenceContext value={value}>{children}</EvidenceContext>;
}

/** 값을 감싸면 근거로 이어진다. 근거를 그릴 수 없으면 그냥 평문으로 남는다. */
export function Cite({
  label,
  needle,
  children,
  className,
}: {
  label: string;
  /** 원문에서 찾을 문자열. 보통 추출된 값이나 `source` 문장 */
  needle: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const { selection, select, enabled } = use(EvidenceContext);
  if (!enabled || !needle) return <>{children}</>;

  const active = selection?.needle === needle;
  return (
    <button
      type="button"
      onClick={() => select({ label, needle })}
      className={cn(
        "group inline-flex items-start gap-1 rounded text-left transition-colors",
        active ? "text-brand" : "hover:text-brand",
        className,
      )}
    >
      <span
        className={cn(
          active && "bg-brand/15 underline decoration-brand/40 decoration-dotted",
        )}
      >
        {children}
      </span>
      <Quote
        className={cn(
          "mt-0.5 size-3 shrink-0 transition-opacity",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-60",
        )}
      />
    </button>
  );
}

/**
 * 원문 패널.
 *
 * 페이지 이미지가 없어도 좌표만으로 「어디쯤」이 보인다. 블록 윤곽이 곧 문서의
 * 뼈대라 어느 대목인지 알아볼 수 있고, 선택한 블록의 원문은 아래에 그대로 뜬다.
 */
export function EvidencePanel({
  evidence,
  cited,
}: {
  evidence: Evidence[];
  /** gaps 단계가 실제로 본 위치. 아무것도 선택하지 않았을 때 이걸 보여준다 */
  cited: Evidence[];
}) {
  const { selection } = use(EvidenceContext);

  const matches = useMemo(
    () => (selection ? matchEvidence(evidence, selection.needle) : []),
    [evidence, selection],
  );

  const shown = selection ? matches.map((match) => match.evidence) : cited;
  const page = shown[0]?.page ?? 1;
  const total = pageCount(evidence);
  const onPage = evidence.filter((item) => item.page === page);
  const hit = new Set(shown.filter((item) => item.page === page).map((item) => item.id));

  return (
    <aside className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <h3 className="text-sm font-medium">원문 근거</h3>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {total > 0 ? `${page}/${total}쪽` : "—"}
        </span>
      </header>

      {/* A4 비율. Studio 좌표가 0~1 정규화라 실제 지면 크기를 몰라도 위치는 맞는다 */}
      <div className="relative aspect-[1/1.414] overflow-hidden rounded-lg border border-border bg-background">
        {onPage.map((item) => (
          <span
            key={item.id}
            className={cn(
              "absolute rounded-[2px] transition-colors",
              hit.has(item.id)
                ? "bg-brand/25 ring-1 ring-brand"
                : "bg-muted-foreground/10",
            )}
            style={{
              left: `${item.box.x * 100}%`,
              top: `${item.box.y * 100}%`,
              width: `${item.box.w * 100}%`,
              height: `${Math.max(item.box.h, 0.004) * 100}%`,
            }}
          />
        ))}
      </div>

      {selection ? (
        matches.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{selection.label}</p>
            {matches.map((match) => (
              <blockquote
                key={match.evidence.id}
                className="border-l-2 border-brand pl-3 text-sm"
              >
                {match.evidence.text}
                <span className="mt-1 block font-mono text-xs text-muted-foreground">
                  {match.evidence.page}쪽 · {match.evidence.category}
                  {match.score < 1 && ` · 유사도 ${match.score.toFixed(2)}`}
                </span>
              </blockquote>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            원문에서 이 문장을 찾지 못했습니다. 모델이 다른 대목을 요약했거나 문서 밖에서
            온 값입니다.
          </p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          {cited.length > 0
            ? "빠진 항목을 판단할 때 에이전트가 본 대목입니다. 값을 누르면 그 값의 근거로 바뀝니다."
            : "값을 누르면 공고 원문의 어디에서 나왔는지 표시합니다."}
        </p>
      )}
    </aside>
  );
}
