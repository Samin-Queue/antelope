import Link from "next/link";
import { CalendarDays, FileDown, Phone } from "lucide-react";

import { DemoFooter } from "../_lib/chrome";
import { NoticeBoard, Pager, PortalHeader, StateBadge } from "../_lib/portal";
import { getSite } from "../_lib/sites";

const site = getSite("youth-housing");

/**
 * 새길주거공사 포털 홈.
 *
 * 여기서 바로 신청으로 못 간다. 공지 목록에 **비슷한 제목이 셋** 있고, 그중
 * 하나는 마감됐고 하나는 정정공고다. 제목만 보고 고르면 틀린다 — 그 판단을
 * 시키는 것이 이 화면의 전부다.
 */
export default function YouthHousingHome() {
  return (
    <>
      <PortalHeader
        site={site}
        nav={[
          { label: "공사소개" },
          { label: "임대주택", href: "/demo/youth-housing" },
          { label: "청약안내", href: "/demo/youth-housing/faq" },
          { label: "고객지원" },
        ]}
      />

      {/* 배너 */}
      <div className={`${site.accent} text-white`}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] tracking-[0.2em] text-white/60 uppercase">
              Youth Safe Housing
            </p>
            <h1 className="mt-2 text-2xl leading-snug font-bold sm:text-[28px]">
              역세권 청년안심주택
              <br />
              「한빛스테이 장량」 입주자 모집
            </h1>
            <p className="mt-3 text-[13px] text-white/80">
              총 412세대 · 임대 의무기간 8년 · 보증금 최대 2,100만원부터
            </p>
          </div>
          <Link
            href="/demo/youth-housing/notice/2026-0087"
            className="inline-flex w-fit items-center gap-2 rounded bg-white px-5 py-3 text-[13px] font-bold text-neutral-900 hover:bg-white/90"
          >
            모집공고 바로가기 →
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
          <section>
            <div className="flex items-end justify-between border-b border-neutral-200 pb-3">
              <h2 className="text-[17px] font-bold text-neutral-900">공고·공지사항</h2>
              <span className="text-[11px] text-neutral-400">
                전체 128건 · 1 / 26 페이지
              </span>
            </div>

            <div className="mt-4">
              <NoticeBoard
                site={site}
                rows={[
                  {
                    no: "공지",
                    pinned: true,
                    title: "2026년 하반기 공공지원민간임대 공급계획 안내",
                    dept: "주거복지처",
                    date: "2026-08-03",
                    views: 12480,
                  },
                  {
                    no: "128",
                    title:
                      "역세권 청년안심주택 「한빛스테이 장량」 공공지원민간임대 입주자 모집공고",
                    href: "/demo/youth-housing/notice/2026-0087",
                    dept: "주거복지처",
                    date: "2026-08-24",
                    views: 3126,
                    files: 4,
                    state: { label: "접수예정", tone: "soon" },
                  },
                  {
                    no: "127",
                    title:
                      "[정정] 「한빛스테이 장량」 주택형별 공급호수 및 임대조건 일부 정정",
                    href: "/demo/youth-housing/notice/2026-0087-1",
                    dept: "주거복지처",
                    date: "2026-08-28",
                    views: 1842,
                    files: 1,
                    state: { label: "정정", tone: "soon" },
                  },
                  {
                    no: "126",
                    title:
                      "역세권 청년안심주택 「새길스테이 죽도」 공공지원민간임대 입주자 모집공고",
                    href: "/demo/youth-housing/notice/2026-0071",
                    dept: "주거복지처",
                    date: "2026-06-15",
                    views: 9021,
                    files: 3,
                    state: { label: "접수마감", tone: "closed" },
                  },
                  {
                    no: "125",
                    title: "「새길스테이 죽도」 예비입주자 순번 안내 (1~180번)",
                    dept: "주거복지처",
                    date: "2026-08-12",
                    views: 5410,
                  },
                  {
                    no: "124",
                    title: "청약센터 추석 연휴 운영 안내 (9.28 ~ 9.30)",
                    dept: "고객지원부",
                    date: "2026-08-19",
                    views: 731,
                  },
                  {
                    no: "123",
                    title: "임대주택 부정 청약 신고 포상금 제도 시행 알림",
                    dept: "감사실",
                    date: "2026-07-30",
                    views: 402,
                  },
                ]}
              />
              <Pager />
            </div>
          </section>

          <div className="grid gap-4 self-start">
            <aside className="rounded border border-neutral-200 p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-neutral-900">
                <CalendarDays className={`size-4 ${site.accentText}`} />
                청약 캘린더
              </p>
              <ul className="mt-3 grid gap-2.5 text-[12px]">
                <li className="flex items-start gap-2">
                  <StateBadge label="특별" tone="soon" />
                  <span className="text-neutral-600">
                    한빛스테이 장량 특별공급
                    <br />
                    <span className="text-neutral-400">
                      일정은 공고문 붙임3 을 확인하세요
                    </span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <StateBadge label="일반" tone="soon" />
                  <span className="text-neutral-600">
                    한빛스테이 장량 일반공급
                    <br />
                    <span className="text-neutral-400">
                      일정은 공고문 붙임3 을 확인하세요
                    </span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <StateBadge label="마감" tone="closed" />
                  <span className="text-neutral-600">새길스테이 죽도 (종료)</span>
                </li>
              </ul>
              <p className="mt-3 rounded bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800">
                단지별 청약 일정은 홈페이지에 별도 게시하지 않습니다. 공고문 붙임
                「공급일정표」가 확정 일정입니다.
              </p>
            </aside>

            <aside className="rounded border border-neutral-200 p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-neutral-900">
                <FileDown className={`size-4 ${site.accentText}`} />
                자주 찾는 서식
              </p>
              <ul className="mt-3 grid gap-1.5 text-[12px]">
                <li>
                  <Link
                    href="/demo/youth-housing/notice/2026-0087"
                    className="text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
                  >
                    청약신청서 지정서식 (HWP)
                  </Link>
                </li>
                <li>
                  <Link
                    href="/demo/youth-housing/notice/2026-0087"
                    className="text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
                  >
                    소득·자산 기준표 (XLSX)
                  </Link>
                </li>
                <li>
                  <Link
                    href="/demo/youth-housing/faq"
                    className="text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
                  >
                    청약 자주 묻는 질문
                  </Link>
                </li>
              </ul>
              <p className="mt-3 text-[11px] text-neutral-400">
                서식은 각 공고 상세 화면의 첨부파일에서 내려받습니다.
              </p>
            </aside>

            <aside className={`${site.accentSoft} rounded p-4`}>
              <p
                className={`flex items-center gap-1.5 text-[13px] font-bold ${site.accentText}`}
              >
                <Phone className="size-4" />
                청약센터
              </p>
              <p className="mt-2 text-[13px] font-bold text-neutral-900">054-000-0000</p>
              <p className="mt-1 text-[11px] text-neutral-500">
                평일 09:00 ~ 18:00 (점심 12:00 ~ 13:00)
              </p>
            </aside>
          </div>
        </div>
      </main>
      <DemoFooter site={site} />
    </>
  );
}
