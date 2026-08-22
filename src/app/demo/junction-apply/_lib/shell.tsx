import Link from "next/link";

/**
 * JUNCTION KOREA 2026 껍데기.
 *
 * 공용 `PortalHeader` 를 쓰지 않는다. 관공서 톤의 흰 배경 포털과 해커톤 랜딩이
 * 같은 껍데기를 쓰면 **한 팀이 만든 사이트**로 보이고, 그 순간 검증 대상으로서
 * 의미가 없어진다. 여긴 검은 배경에 영문이 먼저 오는 사이트다.
 */

export const NAV = [
  { label: "Overview", href: "/demo/junction-apply" as const },
  { label: "Tracks", href: "/demo/junction-apply/tracks" as const },
  { label: "FAQ", href: "/demo/junction-apply/faq" as const },
];

export function JunctionHeader({ active }: { active?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0b12]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3.5">
        <Link href="/demo/junction-apply" className="flex items-baseline gap-2">
          <span className="text-[15px] font-black tracking-[0.18em] text-white">
            JUNCTION
          </span>
          <span className="rounded bg-[#7c4dff] px-1.5 py-0.5 text-[10px] font-bold text-white">
            KOREA 2026
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-[13px]">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={
                active === item.label
                  ? "font-semibold text-white"
                  : "text-white/55 hover:text-white"
              }
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/demo/junction-apply/apply"
            className="rounded bg-white px-3.5 py-1.5 text-[12px] font-bold text-[#0b0b12] hover:bg-white/90"
          >
            Apply
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function JunctionFooter() {
  return (
    <footer className="mt-20 border-t border-white/10">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 text-[12px] leading-relaxed text-white/45">
        <p className="text-[13px] font-bold text-white/80">
          JUNCTION KOREA 2026 Organizing Committee
        </p>
        <p className="mt-1.5">
          POSCO International Center, Pohang, Republic of Korea ·
          apply@junctionkorea.example
        </p>
        <p className="mt-4 text-white/30">
          This site is a fictional replica built to test a document agent. It is not
          affiliated with any real event, and nothing entered here leaves the browser.
          검증용 가상 사이트입니다.
        </p>
      </div>
    </footer>
  );
}

export function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16">
      {eyebrow && (
        <p className="text-[11px] font-semibold tracking-[0.3em] text-[#a78bfa] uppercase">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-[26px] font-bold tracking-tight text-white">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function DarkTable({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto rounded border border-white/10">
      <table className="w-full min-w-[560px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-white/5 text-white/60">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-white/10 text-white/80">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
