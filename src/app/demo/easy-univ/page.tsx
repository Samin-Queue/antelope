import Link from "next/link";
import { CalendarClock, GraduationCap, Phone } from "lucide-react";

import { DemoFooter } from "../_lib/chrome";
import { NoticeBoard, Pager, PortalHeader } from "../_lib/portal";
import { getSite } from "../_lib/sites";

const site = getSite("easy-univ");

/**
 * 이지대학교 입학처 홈.
 *
 * 게시판에 수시·정시·편입이 섞여 있다. **정시 모집요강 예고**가 수시 공고 바로
 * 아래에 붙어 있어 제목만 훑으면 잘못 들어간다 — 대학 입학처가 실제로 그렇다.
 */
export default function EasyUnivHome() {
  return (
    <>
      <PortalHeader
        site={site}
        nav={[
          { label: "입학안내" },
          { label: "모집요강", href: "/demo/easy-univ" },
          { label: "모집단위", href: "/demo/easy-univ/majors" },
          { label: "입학상담" },
        ]}
        utility={["대학 홈", "ENGLISH", "원서접수 로그인"]}
      />

      <div className={`${site.accent} text-white`}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] tracking-[0.25em] text-white/60 uppercase">
              Easy University Admissions
            </p>
            <h1 className="mt-2 text-2xl leading-snug font-bold sm:text-[30px]">
              2027학년도 수시모집
            </h1>
            <p className="mt-3 text-[13px] text-white/85">
              원서접수 2026. 9. 9.(수) 09:00 ~ 9. 11.(금) 18:00 · 인터넷 접수만 가능
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/demo/easy-univ/notice/2027-susi"
              className="rounded bg-white px-5 py-3 text-center text-[13px] font-bold text-[#00563f] hover:bg-white/90"
            >
              수시모집요강 보기
            </Link>
            <Link
              href="/demo/easy-univ/apply"
              className="rounded border border-white/40 px-5 py-3 text-center text-[13px] font-bold text-white hover:bg-white/10"
            >
              원서접수 바로가기
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
          <section>
            <div className="flex items-end justify-between border-b border-neutral-200 pb-3">
              <h2 className="text-[17px] font-bold text-neutral-900">입학처 공지사항</h2>
              <span className="text-[11px] text-neutral-400">전체 214건</span>
            </div>

            <div className="mt-4">
              <NoticeBoard
                site={site}
                rows={[
                  {
                    no: "공지",
                    pinned: true,
                    title: "입학 관련 사칭 컨설팅 업체 주의 안내",
                    dept: "입학처",
                    date: "2026-07-02",
                    views: 8210,
                  },
                  {
                    no: "214",
                    title: "2027학년도 수시모집 요강 및 원서접수 안내",
                    href: "/demo/easy-univ/notice/2027-susi",
                    dept: "입학처",
                    date: "2026-08-20",
                    views: 41250,
                    files: 4,
                    state: { label: "접수예정", tone: "soon" },
                  },
                  {
                    no: "213",
                    title: "2027학년도 수시모집 전형일정 및 고사 시간표 안내",
                    href: "/demo/easy-univ/notice/2027-schedule",
                    dept: "입학처",
                    date: "2026-08-20",
                    views: 22140,
                    files: 1,
                  },
                  {
                    no: "212",
                    title: "2027학년도 정시모집 주요사항 예고",
                    href: "/demo/easy-univ/notice/2027-jeongsi",
                    dept: "입학처",
                    date: "2026-08-14",
                    views: 15980,
                    state: { label: "예고", tone: "closed" },
                  },
                  {
                    no: "211",
                    title: "2026학년도 편입학 추가모집 최종 마감 안내",
                    dept: "입학처",
                    date: "2026-08-06",
                    views: 4120,
                    state: { label: "마감", tone: "closed" },
                  },
                  {
                    no: "210",
                    title: "논술고사 고사장 배정 및 유의사항 (2026-11-15)",
                    href: "/demo/easy-univ/notice/essay-venue",
                    dept: "입학처",
                    date: "2026-08-18",
                    views: 9870,
                  },
                  {
                    no: "209",
                    title: "학생부종합전형 자기소개서 작성 시 금지사항 안내",
                    dept: "입학처",
                    date: "2026-08-11",
                    views: 6640,
                  },
                ]}
              />
              <Pager />
            </div>
          </section>

          <div className="grid gap-4 self-start">
            <aside className="rounded border border-neutral-200 p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-neutral-900">
                <CalendarClock className={`size-4 ${site.accentText}`} />
                주요 일정
              </p>
              <ul className="mt-3 grid gap-2 text-[12px] text-neutral-600">
                <li className="flex justify-between gap-2">
                  <span>원서접수</span>
                  <span className="font-medium text-neutral-900">9.9 ~ 9.11</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>서류제출 마감</span>
                  <span className="font-medium text-neutral-900">9.15</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>논술고사</span>
                  <span className="font-medium text-neutral-900">11.15</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>면접·실기</span>
                  <span className="text-neutral-400">전형별 상이</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>합격자 발표</span>
                  <span className="font-medium text-neutral-900">12.11</span>
                </li>
              </ul>
              <p className="mt-3 rounded bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800">
                전형별 면접일과 고사 시간표는 공지 게시물의 첨부 「전형일정.xlsx」를
                확인하세요.
              </p>
            </aside>

            <aside className="rounded border border-neutral-200 p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-neutral-900">
                <GraduationCap className={`size-4 ${site.accentText}`} />
                모집단위
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-neutral-600">
                7개 단과대학 25개 모집단위. 학과별 모집인원은 요강 붙임
                「모집단위별_모집인원.xlsx」에 있습니다.
              </p>
              <Link
                href="/demo/easy-univ/majors"
                className={`mt-2 inline-block text-[12px] font-semibold underline underline-offset-4 ${site.accentText}`}
              >
                모집단위 안내 →
              </Link>
            </aside>

            <aside className={`${site.accentSoft} rounded p-4`}>
              <p
                className={`flex items-center gap-1.5 text-[13px] font-bold ${site.accentText}`}
              >
                <Phone className="size-4" />
                입학상담
              </p>
              <p className="mt-2 text-[13px] font-bold text-neutral-900">054-000-0000</p>
              <p className="mt-1 text-[11px] text-neutral-500">
                평일 09:00 ~ 17:30 · admission@easy.example
              </p>
            </aside>
          </div>
        </div>
      </main>
      <DemoFooter site={site} />
    </>
  );
}
