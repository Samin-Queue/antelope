import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { site } from "@/content/site";

/**
 * 지식 베이스 섹션.
 *
 * 가짜 인용 대신 실측 유사도를 보여준다. 세 줄이 곧 「왜 다른 말로 물어도
 * 찾아내는가」의 증명이라 여기에 형용사를 더 얹을 이유가 없다.
 */
export function Memory() {
  const { memory } = site;

  return (
    <section id="memory" className="border-y border-border/60 bg-card/30">
      <div className="mx-auto w-full max-w-7xl px-5 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand">{memory.eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {memory.headline}
          </h2>
          <p className="mt-4 leading-relaxed text-pretty text-muted-foreground">
            {memory.sub}
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-border bg-background">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-normal">{memory.tableHead.query}</th>
                    <th className="px-5 py-3 font-normal">{memory.tableHead.match}</th>
                    <th className="px-5 py-3 text-right font-normal">
                      {memory.tableHead.score}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {memory.rows.map((row) => (
                    <tr
                      key={`${row.query}-${row.match}`}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="px-5 py-3.5">{row.query}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5",
                            row.hit ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {row.hit ? (
                            <Check aria-hidden className="size-3.5 text-brand" />
                          ) : (
                            <Minus aria-hidden className="size-3.5" />
                          )}
                          {row.match}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-5 py-3.5 text-right font-mono",
                          row.hit ? "text-brand" : "text-muted-foreground/60",
                        )}
                      >
                        {row.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border/60 px-5 py-4 text-xs leading-relaxed text-muted-foreground">
              {memory.note}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {[memory.aside, memory.graph].map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-border bg-background p-6"
              >
                <h3 className="text-sm font-medium">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {card.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
