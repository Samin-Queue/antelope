import { ArrowRight } from "lucide-react";

import { site } from "@/content/site";

export function Comparison() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-24">
      <div className="text-center">
        <p className="text-sm font-medium text-brand">{site.comparison.eyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {site.comparison.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-pretty text-muted-foreground">
          {site.comparison.sub}
        </p>
      </div>

      {/* 두 열이 무엇인지 밝혀 준다. 취소선만으로는 어느 쪽이 지금인지 모른다 */}
      <div className="mt-12 hidden gap-4 px-6 sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <span className="text-xs text-muted-foreground">
          {site.comparison.columns.before}
        </span>
        <span aria-hidden className="size-4" />
        <span className="text-xs font-medium text-brand">
          {site.comparison.columns.after}
        </span>
      </div>

      {/* 열 라벨이 숨는 모바일에서는 ul 이 위 여백을 직접 진다 */}
      <ul className="mt-12 space-y-3 sm:mt-3">
        {site.comparison.rows.map((row) => (
          <li
            key={row.after}
            className="grid items-center gap-4 rounded-2xl border border-border bg-card px-6 py-5 sm:grid-cols-[1fr_auto_1fr]"
          >
            <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/40">
              {row.before}
            </span>
            <ArrowRight className="hidden size-4 text-brand sm:block" />
            <span className="text-sm font-medium">{row.after}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
