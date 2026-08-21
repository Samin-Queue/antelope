import { ArrowRight } from "lucide-react";

import { site } from "@/content/site";

export function Comparison() {
  return (
    <section id="pricing" className="mx-auto w-full max-w-5xl px-5 py-24">
      <div className="text-center">
        <p className="text-sm font-medium text-brand">{site.comparison.eyebrow}</p>
        <h2 className="mt-3 font-serif text-3xl font-normal tracking-tight text-balance sm:text-4xl">
          {site.comparison.headline}
        </h2>
      </div>

      <ul className="mt-12 space-y-3">
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
