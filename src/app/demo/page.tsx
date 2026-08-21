import Link from "next/link";

import { demoSites } from "./_lib/sites";

/**
 * 데모 사이트 인덱스. navbar 어디에도 링크되지 않는다 — 팀이 URL 로만 들어온다.
 */
export default function DemoIndex() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-14">
      <p className="text-xs font-semibold tracking-widest text-neutral-400 uppercase">
        Internal
      </p>
      <h1 className="mt-2 text-2xl font-bold">데모 공고 사이트</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
        실제 사이트에 자동 신청을 시도할 수 없어 만든 검증용 가상 사이트다. 각 사이트는
        공고문과 신청 폼을 함께 갖고, <strong>클래스마다 신청 방식이 다르다</strong> —
        파일 업로드, 동적 행 추가, 캐스케이딩 선택, 실시간 계산, 드래그앤드롭. 여기 있는
        기관·기업은 전부 가상이며 입력값은 브라우저를 벗어나지 않는다.
      </p>

      <ul className="mt-10 grid gap-3">
        {demoSites.map((site) => (
          <li
            key={site.slug}
            className="rounded-lg border border-neutral-200 transition-colors hover:border-neutral-400"
          >
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
                <div className="mt-3 flex gap-4 text-[13px]">
                  <Link
                    href={`/demo/${site.slug}`}
                    className="font-medium text-neutral-900 underline underline-offset-4"
                  >
                    공고문
                  </Link>
                  <Link
                    href={`/demo/${site.slug}/apply`}
                    className="font-medium text-neutral-900 underline underline-offset-4"
                  >
                    신청 폼
                  </Link>
                  <span className="text-neutral-400">마감 {site.deadline}</span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
