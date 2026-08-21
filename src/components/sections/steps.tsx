import { site } from "@/content/site";

export function Steps() {
  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-5 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">동작 방식</h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {site.steps.map((item) => (
            <li key={item.step}>
              <div className="font-mono text-sm text-muted-foreground">{item.step}</div>
              <div className="mt-2 text-lg font-medium">{item.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
