import { site } from "@/content/site";

export function Stats() {
  return (
    <section className="border-y border-border/60 bg-card/30">
      <div className="mx-auto w-full max-w-7xl px-5 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand">{site.stats.eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {site.stats.headline}
          </h2>
          <p className="mt-3 text-muted-foreground">{site.stats.sub}</p>
        </div>

        <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {site.stats.items.map((item) => (
            <div key={item.label} className="bg-background p-6">
              <dt className="font-mono text-3xl font-semibold tracking-tight text-brand">
                {item.value}
              </dt>
              <dd className="mt-2 text-sm font-medium">{item.label}</dd>
              <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.detail}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
