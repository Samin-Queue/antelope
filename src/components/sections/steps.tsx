import { cn } from "@/lib/utils";
import { SymbolBadge } from "@/components/brand";
import { site } from "@/content/site";

/**
 * 사용자가 겪는 다섯 단계.
 *
 * 첫 칸만 사람이 하고 나머지 넷은 에이전트가 한다. 그 경계가 이 섹션의
 * 요점이므로 첫 칸은 넓게·다른 색으로 두고, 나머지 넷에는 심볼을 붙인다.
 *
 * `handoff` 는 사람에서 에이전트로 넘어가는 문장이라 첫 칸에만 있다.
 * 그래서 「그게 없으면 에이전트의 단계」가 성립한다.
 */
export function Steps() {
  return (
    <section id="steps" className="border-y border-border/60 bg-card/30">
      <div className="mx-auto w-full max-w-7xl px-5 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand">{site.steps.eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {site.steps.headline}
          </h2>
          <p className="mt-3 text-muted-foreground">{site.steps.sub}</p>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1fr_1fr]">
          {site.steps.items.map((item) => (
            <li
              key={item.title}
              className={cn(
                "flex flex-col p-6",
                item.handoff ? "bg-brand/5" : "bg-background",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className={cn("text-sm font-medium", item.handoff && "text-brand")}>
                  {item.title}
                </h3>
                {!item.handoff && (
                  // 심볼이 곧 「이건 Antelope 가 한다」는 표시다. 라벨을 넷 다
                  // 적으면 반복이 시끄러워 마크 하나로 대신한다.
                  <span aria-hidden className="shrink-0">
                    <SymbolBadge className="size-5 rounded-md" />
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {item.body}
              </p>
              {item.handoff && (
                <p className="mt-auto pt-4 text-xs leading-relaxed font-medium text-foreground">
                  {item.handoff}
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
