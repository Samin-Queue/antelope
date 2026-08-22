import Link from "next/link";
import { Download, FileSpreadsheet, FileText, ImageIcon, Paperclip } from "lucide-react";

import { fileHref, type DemoFile } from "./attachments";
import type { DemoSite } from "./sites";

/**
 * v4 데모용 포털 부품.
 *
 * v1 은 공고문 한 장이었다. v4 는 **기관 사이트를 통째로** 흉내내야 한다 —
 * 공지 게시판에서 비슷한 제목 여럿 중 하나를 고르고, 상세로 들어가 첨부를 찾고,
 * FAQ 에 흩어진 조건을 줍는 그 경로가 검증 대상이기 때문이다.
 *
 * 여기서도 shadcn 을 쓰지 않는다. 우리 프리미티브가 보이는 순간 「외부 사이트」가
 * 아니게 된다.
 */

/* ------------------------------------------------------------------ */
/* 껍데기                                                              */
/* ------------------------------------------------------------------ */

export function PortalHeader({
  site,
  nav,
  utility = ["사이트맵", "ENGLISH", "로그인"],
}: {
  site: DemoSite;
  nav: { label: string; href?: string; active?: boolean }[];
  utility?: string[];
}) {
  return (
    <header className="border-b border-neutral-200">
      <div className="border-b border-neutral-100 bg-neutral-50">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-end gap-4 px-5 py-1.5 text-[11px] text-neutral-500">
          {utility.map((u) => (
            <span key={u}>{u}</span>
          ))}
        </div>
      </div>
      <div className="bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-5 py-4">
          <Link href={`/demo/${site.slug}`} className="flex items-center gap-3">
            <span
              className={`${site.accent} flex size-9 items-center justify-center rounded text-sm font-bold text-white`}
            >
              {site.org.slice(0, 1)}
            </span>
            <span className="leading-tight">
              <span className="block text-[17px] font-bold tracking-tight text-neutral-900">
                {site.org}
              </span>
              <span className="block text-[10px] tracking-[0.2em] text-neutral-400 uppercase">
                {site.orgEn}
              </span>
            </span>
          </Link>
          <nav className="hidden gap-7 text-[13px] font-medium sm:flex">
            {nav.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className={
                    item.active
                      ? `${site.accentText} font-semibold`
                      : "text-neutral-600 hover:text-neutral-900"
                  }
                >
                  {item.label}
                </Link>
              ) : (
                <span key={item.label} className="text-neutral-400">
                  {item.label}
                </span>
              ),
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

export function Breadcrumb({ items }: { items: string[] }) {
  return (
    <p className="text-[11px] text-neutral-400">
      {items.map((item, i) => (
        <span key={item}>
          {i > 0 && <span className="mx-1.5">›</span>}
          <span className={i === items.length - 1 ? "text-neutral-600" : ""}>{item}</span>
        </span>
      ))}
    </p>
  );
}

export function PageTitle({
  site,
  title,
  desc,
}: {
  site: DemoSite;
  title: string;
  desc?: string;
}) {
  return (
    <div className="border-b border-neutral-200 pb-5">
      <h1 className="text-[22px] font-bold text-neutral-900">{title}</h1>
      {desc && <p className="mt-2 text-[13px] text-neutral-600">{desc}</p>}
      <span className={`mt-3 block h-0.5 w-10 ${site.accent}`} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 공지 게시판                                                          */
/* ------------------------------------------------------------------ */

export type BoardRow = {
  no: string;
  title: string;
  href?: string;
  dept: string;
  date: string;
  views: number;
  files?: number;
  /** 마감·진행 같은 상태 뱃지 */
  state?: { label: string; tone: "open" | "closed" | "soon" };
  /** 게시판 맨 위에 고정되는 공지 */
  pinned?: boolean;
};

export function NoticeBoard({ site, rows }: { site: DemoSite; rows: BoardRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="border-y-2 border-neutral-800 bg-white text-neutral-600">
            <th className="w-16 px-3 py-2.5 text-center font-semibold">번호</th>
            <th className="px-3 py-2.5 text-left font-semibold">제목</th>
            <th className="w-28 px-3 py-2.5 text-center font-semibold">담당</th>
            <th className="w-24 px-3 py-2.5 text-center font-semibold">등록일</th>
            <th className="w-16 px-3 py-2.5 text-center font-semibold">조회</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.no + row.title}
              className={`border-b border-neutral-200 ${row.pinned ? "bg-neutral-50" : ""}`}
            >
              <td className="px-3 py-3 text-center text-neutral-500">
                {row.pinned ? (
                  <span
                    className={`${site.accentSoft} ${site.accentText} rounded px-1.5 py-0.5 text-[10px] font-bold`}
                  >
                    공지
                  </span>
                ) : (
                  row.no
                )}
              </td>
              <td className="px-3 py-3">
                <span className="flex flex-wrap items-center gap-2">
                  {row.state && <StateBadge {...row.state} />}
                  {row.href ? (
                    <Link
                      href={row.href}
                      className="font-medium text-neutral-900 hover:underline hover:underline-offset-4"
                    >
                      {row.title}
                    </Link>
                  ) : (
                    <span className="text-neutral-500">{row.title}</span>
                  )}
                  {row.files ? (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-neutral-400">
                      <Paperclip className="size-3" />
                      {row.files}
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-3 text-center text-neutral-500">{row.dept}</td>
              <td className="px-3 py-3 text-center text-neutral-500">{row.date}</td>
              <td className="px-3 py-3 text-center text-neutral-400">
                {row.views.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StateBadge({ label, tone }: { label: string; tone: string }) {
  const cls =
    tone === "open"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : tone === "soon"
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-neutral-300 bg-neutral-100 text-neutral-500";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

/** 게시판 아래 페이지네이션 — 눌러도 아무 일도 없지만 있어야 게시판처럼 보인다 */
export function Pager({ pages = 5, current = 1 }: { pages?: number; current?: number }) {
  return (
    <div className="mt-6 flex items-center justify-center gap-1 text-[13px]">
      <span className="px-2 py-1 text-neutral-400">‹</span>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <span
          key={p}
          className={
            p === current
              ? "rounded border border-neutral-800 px-2.5 py-1 font-semibold text-neutral-900"
              : "px-2.5 py-1 text-neutral-500"
          }
        >
          {p}
        </span>
      ))}
      <span className="px-2 py-1 text-neutral-400">›</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 첨부                                                                */
/* ------------------------------------------------------------------ */

const FILE_ICON = {
  pdf: FileText,
  hwp: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
} as const;

export function AttachmentList({
  slug,
  files,
  title = "첨부파일",
}: {
  slug: string;
  files: DemoFile[];
  title?: string;
}) {
  if (files.length === 0) return null;
  return (
    <section className="mt-8 rounded border border-neutral-200 bg-neutral-50">
      <p className="flex items-center gap-1.5 border-b border-neutral-200 px-4 py-2.5 text-[13px] font-semibold text-neutral-700">
        <Paperclip className="size-3.5" />
        {title} ({files.length})
      </p>
      <ul className="divide-y divide-neutral-200">
        {files.map((f) => {
          const Icon = FILE_ICON[f.format];
          return (
            <li key={f.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Icon className="size-4 shrink-0 text-neutral-400" />
              <span className="min-w-0 flex-1">
                <a
                  href={fileHref(slug, f.name)}
                  className="block text-[13px] font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
                >
                  {f.name}
                </a>
                <span className="mt-0.5 block text-[11px] text-neutral-500">
                  {f.title}
                  {f.note ? ` · ${f.note}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-neutral-400 tabular-nums">
                {f.size}
              </span>
              <a
                href={fileHref(slug, f.name)}
                className="shrink-0 rounded border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:border-neutral-500"
              >
                내려받기
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 공고문 PDF·홍보 이미지 — 데모의 첫 트리거를 여기서 집는다 */
export function TriggerBar({ site }: { site: DemoSite }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2 print:hidden">
      <a
        href={`/demo/${site.slug}/notice.pdf`}
        download
        className="inline-flex items-center gap-1.5 rounded border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-500 hover:bg-neutral-50"
      >
        <Download className="size-3.5" />
        공고문 PDF 내려받기
      </a>
      {site.poster && (
        <a
          href={`/demo/${site.slug}/poster.png`}
          download
          className="inline-flex items-center gap-1.5 rounded border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-500 hover:bg-neutral-50"
        >
          <ImageIcon className="size-3.5" />
          홍보 이미지 내려받기
        </a>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ — 자바스크립트 없이 details 로 편다                              */
/* ------------------------------------------------------------------ */

export function Faq({
  items,
}: {
  items: { q: string; a: React.ReactNode; tag?: string }[];
}) {
  return (
    <div className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex cursor-pointer list-none items-start gap-3 px-1 py-4 text-[13px] font-medium text-neutral-900">
            <span className="mt-0.5 font-bold text-neutral-400">Q</span>
            <span className="flex-1">
              {item.tag && (
                <span className="mr-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
                  {item.tag}
                </span>
              )}
              {item.q}
            </span>
            <span className="text-neutral-400 group-open:rotate-180">⌄</span>
          </summary>
          <div className="flex gap-3 px-1 pb-5 text-[13px] leading-[1.85] text-neutral-700">
            <span className="mt-0.5 font-bold text-neutral-300">A</span>
            <div className="flex-1 space-y-2">{item.a}</div>
          </div>
        </details>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 사이드 박스                                                          */
/* ------------------------------------------------------------------ */

export function SideBox({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: { label: string; value: React.ReactNode }[];
  accent: string;
}) {
  return (
    <aside className="rounded border border-neutral-200">
      <p className={`${accent} rounded-t px-4 py-2 text-[13px] font-semibold text-white`}>
        {title}
      </p>
      <dl className="divide-y divide-neutral-100 px-4">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-3 py-2.5 text-[12px]">
            <dt className="w-20 shrink-0 text-neutral-500">{r.label}</dt>
            <dd className="flex-1 text-neutral-800">{r.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
