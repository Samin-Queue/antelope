import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * `/engine` 전용 프리미티브.
 *
 * 이 페이지는 「읽는 문서」가 아니라 **대조하는 문서**다. 그래서 모든 블록에
 * 파일 경로나 실측 근거를 붙일 자리를 만들어 둔다 — 주장만 있고 출처가 없는
 * 칸이 하나라도 있으면 나머지 주장까지 같이 의심받는다.
 *
 * 문구는 여기 박지 않는다. 전부 `src/content/engine.ts` 에서 온다.
 */

export function Section({
  id,
  eyebrow,
  headline,
  sub,
  children,
  className,
}: {
  id?: string;
  eyebrow: string;
  headline: string;
  sub?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16", className)}
    >
      <p className="font-mono text-xs tracking-wide text-brand">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {headline}
      </h2>
      {sub && (
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-pretty text-muted-foreground">
          <T>{sub}</T>
        </p>
      )}
      <div className="mt-10">{children}</div>
    </section>
  );
}

/** 하위 제목. 섹션 하나가 여러 주제를 담을 때 */
export function Sub({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-semibold tracking-tight">{children}</h3>;
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card/40 p-5", className)}>
      {children}
    </div>
  );
}

/** 파일 경로. 대조할 수 있어야 검증할 수 있다 */
export function Source({ path }: { path: string }) {
  return (
    <p className="mt-4 font-mono text-[11px] break-all text-muted-foreground/70">
      {path}
    </p>
  );
}

/**
 * 백틱을 코드로 바꾼다.
 *
 * 이 페이지의 문장은 식별자를 계속 부른다 — `data.input` 과 `data.prompt` 는
 * 그 차이가 요점이라 본문 글자와 같은 모양으로 서면 읽는 사람이 그냥 지나친다.
 * 문구 파일에 마크업을 넣지 않으면서 그 구분을 살리는 자리가 여기다.
 */
export function T({ children }: { children: string }) {
  if (!children.includes("`")) return <>{children}</>;
  return (
    <>
      {children.split(/`([^`]+)`/).map((piece, index) =>
        index % 2 === 1 ? (
          <code
            key={index}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] break-words"
          >
            {piece}
          </code>
        ) : (
          <span key={index}>{piece}</span>
        ),
      )}
    </>
  );
}

export function Mono({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "brand" | "muted";
}) {
  return (
    <code
      className={cn(
        "rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]",
        tone === "brand" && "text-brand",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      {children}
    </code>
  );
}

/** 실측값을 눈에 띄게. 지어낸 숫자를 넣지 않는다는 약속의 표시이기도 하다 */
export function Measured({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-lg border border-brand/25 bg-brand/5 px-3.5 py-2.5 text-xs leading-relaxed text-pretty">
      <span className="font-mono text-brand">실측</span>{" "}
      <span className="text-muted-foreground">{children}</span>
    </p>
  );
}

export function Table({
  head,
  rows,
  className,
}: {
  head: readonly string[];
  rows: readonly (readonly ReactNode[])[];
  className?: string;
}) {
  return (
    // 표는 자기 상자 안에서만 가로로 흐른다. 페이지 본문이 가로로 밀리면 안 된다.
    <div className={cn("overflow-x-auto rounded-xl border border-border", className)}>
      <table className="w-full min-w-2xl border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {head.map((cell) => (
              <th
                key={cell}
                className="px-4 py-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border/60 last:border-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    "px-4 py-3 align-top leading-relaxed",
                    cellIndex === 0
                      ? "font-mono text-xs"
                      : "text-xs text-muted-foreground",
                  )}
                >
                  {typeof cell === "string" ? <T>{cell}</T> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 이름 + 한 줄. 규칙·도구·스텝처럼 「목록인데 설명이 필요한 것」 */
export function DefGrid({
  items,
  columns = 2,
}: {
  items: ReadonlyArray<{ name: string; body: string; tag?: string }>;
  columns?: 2 | 3;
}) {
  return (
    <ul
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border border-border bg-border",
        columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {items.map((item) => (
        <li key={item.name} className="bg-background p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-xs text-brand">{item.name}</p>
            {item.tag && (
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {item.tag}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            <T>{item.body}</T>
          </p>
        </li>
      ))}
    </ul>
  );
}
