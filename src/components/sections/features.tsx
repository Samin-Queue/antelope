import { Check } from "lucide-react";

import { site } from "@/content/site";

export function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-7xl px-5 py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-brand">{site.features.eyebrow}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {site.features.headline}
        </h2>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {site.features.items.map((item, index) => (
          <article
            key={item.title}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 transition-colors hover:border-brand/40"
          >
            <span className="font-mono text-xs text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-3 text-lg font-medium">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.body}
            </p>
            <p className="mt-5 flex items-center gap-2 text-sm text-foreground/80">
              <Check className="size-4 text-brand" />
              {item.bullet}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
