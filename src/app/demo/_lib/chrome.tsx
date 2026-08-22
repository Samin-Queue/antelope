import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";

import type { DemoSite } from "./sites";

/**
 * 가짜 사이트 껍데기. 사이트마다 색과 이름이 달라 한 팀이 만든 것처럼 보이지 않는다.
 * 우리 shadcn 프리미티브를 일부러 쓰지 않는다 — 외부 사이트여야 하기 때문이다.
 */

export function DemoHeader({
  site,
  nav = [],
}: {
  site: DemoSite;
  nav?: { label: string; active?: boolean }[];
}) {
  return (
    <header>
      <div className={`${site.accent} text-white`}>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3">
          <Link href={`/demo/${site.slug}`} className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight">{site.org}</span>
            <span className="text-[11px] tracking-widest text-white/60 uppercase">
              {site.orgEn}
            </span>
          </Link>
          <span className="text-xs text-white/70">로그인 · 회원가입</span>
        </div>
      </div>
      {nav.length > 0 && (
        <nav className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex w-full max-w-5xl gap-6 px-5">
            {nav.map((item) => (
              <span
                key={item.label}
                className={`border-b-2 py-2.5 text-[13px] ${
                  item.active
                    ? `border-current font-semibold ${site.accentText}`
                    : "border-transparent text-neutral-500"
                }`}
              >
                {item.label}
              </span>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

export function DemoFooter({ site }: { site: DemoSite }) {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 text-xs leading-relaxed text-neutral-500">
        <p className="font-semibold text-neutral-700">{site.org}</p>
        <p className="mt-1">
          (00000) 경상북도 포항시 남구 가상로 000 · 대표전화 054-000-0000
        </p>
        <p className="mt-3 text-neutral-400">
          이 페이지는 문서 에이전트 검증용으로 만든 가상의 사이트입니다. 실제 기관·기업과
          무관하며 여기서 수집되는 정보는 브라우저를 벗어나지 않습니다.
        </p>
      </div>
    </footer>
  );
}

/** 공고문 상단의 제목 블록 */
export function NoticeHead({
  site,
  meta,
}: {
  site: DemoSite;
  meta: { label: string; value: string }[];
}) {
  return (
    <div className="border-b border-neutral-200 pb-6">
      <p className={`text-xs font-semibold ${site.accentText}`}>{site.klass}</p>
      <h1 className="mt-2 text-2xl leading-snug font-bold text-neutral-900">
        {site.title}
      </h1>
      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-2">
        {meta.map((m) => (
          <div key={m.label} className="flex gap-3 border-b border-neutral-100 py-1.5">
            <dt className="w-20 shrink-0 text-neutral-500">{m.label}</dt>
            <dd className="text-neutral-800">{m.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={`/demo/${site.slug}/notice.pdf`}
          download
          className="inline-flex items-center gap-1.5 rounded border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-500 hover:bg-neutral-50"
        >
          <Download className="size-3.5" />
          공고문 PDF 다운로드
        </a>
        <Link
          href={`/demo/${site.slug}/apply`}
          className={`${site.accent} inline-flex items-center gap-1.5 rounded px-3 py-2 text-xs font-semibold text-white hover:opacity-90`}
        >
          신청하러 가기
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

/** 공고문 본문의 조 단위 섹션 */
export function Article({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-bold text-neutral-900">
        {n}. {title}
      </h2>
      <div className="mt-2.5 space-y-2 text-[13px] leading-[1.85] text-neutral-700">
        {children}
      </div>
    </section>
  );
}

/** 공고문 안의 표 — 배점표·요건표가 여기 들어간다 */
export function NoticeTable({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-neutral-100">
            {head.map((h) => (
              <th
                key={h}
                className="border border-neutral-300 px-3 py-2 text-left font-semibold text-neutral-700"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border border-neutral-300 px-3 py-2 align-top text-neutral-700"
                >
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

export function ApplyCta({ site }: { site: DemoSite }) {
  return (
    <div className="mt-10 flex flex-col items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-[13px]">
        <p className="font-semibold text-neutral-800">접수 마감</p>
        <p className="text-neutral-500">{site.deadline} 까지</p>
      </div>
      <Link
        href={`/demo/${site.slug}/apply`}
        className={`${site.accent} rounded px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90`}
      >
        온라인 신청하기
      </Link>
    </div>
  );
}
