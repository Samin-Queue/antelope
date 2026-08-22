import Link from "next/link";

import { filesFor } from "./_lib/attachments";
import { demoSites, noticePath, type DemoSite } from "./_lib/sites";

/**
 * 데모 사이트 인덱스. navbar 어디에도 링크되지 않는다 — 팀이 URL 로만 들어온다.
 */
export default function DemoIndex() {
  const v4 = demoSites.filter((s) => s.gen === "v4");
  const v1 = demoSites.filter((s) => s.gen === "v1");

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-14">
      <p className="text-xs font-semibold tracking-widest text-neutral-400 uppercase">
        Internal
      </p>
      <h1 className="mt-2 text-2xl font-bold">데모 공고 사이트</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
        실제 사이트에 자동 신청을 시도할 수 없어 만든 검증용 가상 사이트다. 여기 있는
        기관·기업은 전부 가상이며 입력값은 브라우저를 벗어나지 않는다.
      </p>

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline gap-3 border-b border-neutral-200 pb-3">
          <h2 className="text-lg font-bold">v4 · 포털 전체를 흉내낸 사이트</h2>
          <span className="text-xs text-neutral-500">
            트리거는 공고문 PDF 또는 홍보 이미지 한 장이다
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-neutral-600">
          <strong>마감일·모집인원·제출서류가 화면에 없다.</strong> 공지 목록에서 비슷한
          제목 여럿 중 하나를 고르고, 상세로 들어가 첨부 HWP·XLSX 를 열어야 실제 값이
          나온다. 신청 페이지 주소만 아는 상태에서 시작해 그 경로를 스스로 찾는 것이 검증
          대상이다.
        </p>
        <ul className="mt-6 grid gap-3">
          {v4.map((site) => (
            <SiteCard key={site.slug} site={site} />
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <div className="flex flex-wrap items-baseline gap-3 border-b border-neutral-200 pb-3">
          <h2 className="text-lg font-bold">v1 · 공고문 한 장 + 신청 폼 한 장</h2>
          <span className="text-xs text-neutral-500">신청 방식의 다양성을 본다</span>
        </div>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-neutral-600">
          클래스마다 신청 방식이 다르다 — 파일 업로드, 동적 행 추가, 캐스케이딩 선택,
          실시간 계산, 드래그앤드롭, 로그인 게이트.
        </p>
        <ul className="mt-6 grid gap-3">
          {v1.map((site) => (
            <SiteCard key={site.slug} site={site} />
          ))}
        </ul>
      </section>
    </main>
  );
}

function SiteCard({ site }: { site: DemoSite }) {
  const files = filesFor(site.slug);
  return (
    <li className="rounded-lg border border-neutral-200 transition-colors hover:border-neutral-400">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div
          className={`${site.accent} mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded text-sm font-bold text-white sm:flex`}
        >
          {site.org.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`${site.accentSoft} ${site.accentText} rounded px-1.5 py-0.5 text-[11px] font-semibold`}
            >
              {site.klass}
            </span>
            <span className="text-xs text-neutral-500">{site.org}</span>
          </div>
          <p className="mt-1.5 font-semibold">{site.title}</p>
          <p className="mt-1 text-[13px] text-neutral-500">{site.mechanism}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            <Link
              href={`/demo/${site.slug}`}
              className="font-medium text-neutral-900 underline underline-offset-4"
            >
              {site.gen === "v4" ? "사이트 홈" : "공고문"}
            </Link>
            {site.noticePath && (
              <Link
                href={noticePath(site)}
                className="font-medium text-neutral-900 underline underline-offset-4"
              >
                공고 상세
              </Link>
            )}
            <Link
              href={`/demo/${site.slug}/apply`}
              className="font-medium text-neutral-900 underline underline-offset-4"
            >
              신청 폼
            </Link>
            <a
              href={`/demo/${site.slug}/notice.pdf`}
              download
              className="font-medium text-neutral-600 underline underline-offset-4"
            >
              공고문 PDF
            </a>
            {site.poster && (
              <a
                href={`/demo/${site.slug}/poster.png`}
                download
                className="font-medium text-neutral-600 underline underline-offset-4"
              >
                홍보 이미지 PNG
              </a>
            )}
            <span className="text-neutral-400">마감 {site.deadline}</span>
          </div>
          {files.length > 0 && (
            <p className="mt-2 text-[12px] text-neutral-400">
              첨부 {files.length}건 · {files.map((f) => f.name).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
