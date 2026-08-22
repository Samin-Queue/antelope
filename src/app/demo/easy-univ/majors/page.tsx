import Link from "next/link";

import { fileHref } from "../../_lib/attachments";
import { DemoFooter, NoticeTable } from "../../_lib/chrome";
import { Breadcrumb, PageTitle, PortalHeader } from "../../_lib/portal";
import { getSite } from "../../_lib/sites";

const site = getSite("easy-univ");

/**
 * 모집단위 안내.
 *
 * **인원이 없다.** 학과 목록과 계열·수업연한만 있고, 몇 명을 뽑는지는 요강 붙임
 * 엑셀에 있다고 쓴다. 원서를 넣으려면 학과를 골라야 하고, 학과를 고르려면 그
 * 파일을 열어야 한다 — 이 화면은 그 갈림길이다.
 */
const COLLEGES = [
  {
    name: "인문사회대학",
    line: "인문",
    majors: [
      ["국어국문학과", "4년", "인문"],
      ["영어영문학과", "4년", "인문"],
      ["사학과", "4년", "인문"],
      ["심리학과", "4년", "인문"],
      ["사회복지학과", "4년", "인문"],
    ],
  },
  {
    name: "경영경제대학",
    line: "인문",
    majors: [
      ["경영학과", "4년", "인문"],
      ["경제학과", "4년", "인문"],
      ["회계세무학과", "4년", "인문"],
      ["국제통상학과", "4년", "인문"],
    ],
  },
  {
    name: "공과대학",
    line: "자연",
    majors: [
      ["기계공학과", "4년", "자연"],
      ["전기전자공학과", "4년", "자연"],
      ["신소재공학과", "4년", "자연"],
      ["화학공학과", "4년", "자연"],
      ["건축학과", "5년", "자연"],
    ],
  },
  {
    name: "IT융합대학",
    line: "자연",
    majors: [
      ["컴퓨터공학과", "4년", "자연"],
      ["인공지능학과", "4년", "자연"],
      ["데이터사이언스학과", "4년", "자연"],
      ["정보보호학과", "4년", "자연"],
    ],
  },
  {
    name: "자연과학대학",
    line: "자연",
    majors: [
      ["수학과", "4년", "자연"],
      ["물리학과", "4년", "자연"],
      ["화학과", "4년", "자연"],
      ["생명과학과", "4년", "자연"],
    ],
  },
  {
    name: "의약학대학",
    line: "자연",
    majors: [
      ["의예과", "6년", "자연"],
      ["약학과", "6년", "자연"],
      ["간호학과", "4년", "자연"],
    ],
  },
  {
    name: "예술체육대학",
    line: "예체능",
    majors: [
      ["디자인학과", "4년", "예체능"],
      ["음악학과", "4년", "예체능"],
      ["체육학과", "4년", "예체능"],
      ["연극영화학과", "4년", "예체능"],
    ],
  },
];

export default function EasyUnivMajors() {
  return (
    <>
      <PortalHeader
        site={site}
        nav={[
          { label: "입학안내" },
          { label: "모집요강", href: "/demo/easy-univ" },
          { label: "모집단위", href: "/demo/easy-univ/majors", active: true },
          { label: "입학상담" },
        ]}
        utility={["대학 홈", "ENGLISH", "원서접수 로그인"]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        <Breadcrumb items={["홈", "입학안내", "모집단위 안내"]} />
        <div className="mt-4">
          <PageTitle
            site={site}
            title="모집단위 안내"
            desc="7개 단과대학 29개 모집단위. 계열은 학생부 반영 교과와 논술 계열을 결정합니다."
          />
        </div>

        <div className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
          이 화면에는 <strong>모집인원이 없습니다.</strong> 전형별·모집단위별 인원은
          수시모집 요강의 붙임1{" "}
          <a
            href={fileHref(site.slug, "모집단위별_모집인원.xlsx")}
            className="font-semibold underline underline-offset-4"
          >
            「모집단위별_모집인원.xlsx」
          </a>
          에 있습니다.
        </div>

        <div className="mt-8 grid gap-8">
          {COLLEGES.map((c) => (
            <section key={c.name}>
              <h2 className="flex items-center gap-2 text-[15px] font-bold text-neutral-900">
                {c.name}
                <span
                  className={`${site.accentSoft} ${site.accentText} rounded px-1.5 py-0.5 text-[10px] font-semibold`}
                >
                  {c.line} 계열
                </span>
              </h2>
              <div className="mt-2.5">
                <NoticeTable
                  head={["모집단위", "수업연한", "계열", "모집인원"]}
                  rows={c.majors.map((m) => [m[0], m[1], m[2], "붙임1 참조"])}
                />
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-4 border-t border-neutral-200 pt-5 text-[13px]">
          <Link
            href="/demo/easy-univ/notice/2027-susi"
            className={`font-semibold underline underline-offset-4 ${site.accentText}`}
          >
            수시모집 요강 보기
          </Link>
          <Link
            href="/demo/easy-univ/apply"
            className={`font-semibold underline underline-offset-4 ${site.accentText}`}
          >
            원서접수 바로가기
          </Link>
        </div>
      </main>
      <DemoFooter site={site} />
    </>
  );
}
