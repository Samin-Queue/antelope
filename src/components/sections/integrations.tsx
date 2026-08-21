import { site } from "@/content/site";

export function Integrations() {
  return (
    <section id="integrations" className="mx-auto w-full max-w-7xl px-5 py-24">
      <div className="rounded-3xl border border-border bg-card/40 px-6 py-16 text-center">
        <h2 className="font-serif text-2xl font-normal tracking-tight text-balance sm:text-3xl">
          {site.integrations.headline}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          {site.integrations.sub}
        </p>
        <ul className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {site.integrations.items.map((item) => (
            <li
              key={item}
              className="bg-background px-4 py-6 text-sm text-muted-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
