import { site } from "@/content/site";

/**
 * Upstage Studio 워크플로 노드.
 *
 * 이름은 `studio-workflow.ts` 의 스텝명 그대로다. 이름만 늘어놓으면 만든
 * 사람만 읽으므로 각 노드가 실제로 무엇을 하는지 한 줄씩 붙였다.
 */
export function Pipeline() {
  return (
    <section id="pipeline" className="mx-auto w-full max-w-7xl px-5 py-24">
      <div className="rounded-3xl border border-border bg-card/40 px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {site.pipeline.headline}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-pretty text-muted-foreground">
            {site.pipeline.sub}
          </p>
        </div>

        <ul className="mx-auto mt-12 grid max-w-4xl gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {site.pipeline.items.map((item) => (
            <li key={item.name} className="bg-background p-5">
              <p className="font-mono text-xs text-brand">{item.name}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {item.desc}
              </p>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
          {site.pipeline.note}
        </p>
      </div>
    </section>
  );
}
