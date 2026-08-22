import Link from "next/link";
import { notFound } from "next/navigation";

import { filesFor } from "../../../_lib/attachments";
import { Article, DemoFooter, NoticeTable } from "../../../_lib/chrome";
import {
  AttachmentList,
  Breadcrumb,
  PortalHeader,
  SideBox,
  StateBadge,
  TriggerBar,
} from "../../../_lib/portal";
import { getSite } from "../../../_lib/sites";

const site = getSite("easy-univ");
const files = filesFor(site.slug);

const IDS = ["2027-susi", "2027-schedule", "essay-venue", "2027-jeongsi"] as const;
type NoticeId = (typeof IDS)[number];

export function generateStaticParams() {
  return IDS.map((id) => ({ id }));
}

export default async function EasyUnivNotice(
  props: PageProps<"/demo/easy-univ/notice/[id]">,
) {
  const { id } = await props.params;
  if (!IDS.includes(id as NoticeId)) notFound();

  return (
    <>
      <PortalHeader
        site={site}
        nav={[
          { label: "입학안내" },
          { label: "모집요강", href: "/demo/easy-univ", active: true },
          { label: "모집단위", href: "/demo/easy-univ/majors" },
          { label: "입학상담" },
        ]}
        utility={["대학 홈", "ENGLISH", "원서접수 로그인"]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        <Breadcrumb items={["홈", "입학안내", "공지사항", "상세"]} />
        {id === "2027-susi" && <Susi />}
        {id === "2027-schedule" && <Schedule />}
        {id === "essay-venue" && <EssayVenue />}
        {id === "2027-jeongsi" && <Jeongsi />}
      </main>
      <DemoFooter site={site} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 수시 모집요강 — 목적지                                               */
/* ------------------------------------------------------------------ */

function Susi() {
  return (
    <>
      <div className="mt-4 border-b border-neutral-200 pb-6">
        <StateBadge label="접수예정" tone="soon" />
        <h1 className="mt-2 text-[23px] leading-snug font-bold text-neutral-900">
          2027학년도 수시모집 요강 및 원서접수 안내
        </h1>
        <p className="mt-2 text-[12px] text-neutral-500">
          입학처 · 2026-08-20 등록 · 조회 41,250
        </p>
        <TriggerBar site={site} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_240px]">
        <div>
          <Article n="1" title="원서접수 기간">
            <NoticeTable
              head={["구분", "내용"]}
              rows={[
                ["접수 기간", "2026. 9. 9.(수) 09:00 ~ 9. 11.(금) 18:00"],
                ["접수 방법", "인터넷 접수만 (방문·우편 접수 없음)"],
                ["접수 사이트", "본교 원서접수 시스템 (로그인 필요)"],
                ["서류 제출 마감", "2026. 9. 15.(화) 18:00"],
              ]}
            />
            <p className="text-neutral-500">
              ※ 마감 시각 이후에는 접수·수정·취소가 불가하다. 전형료 결제까지 완료해야
              접수로 인정한다.
            </p>
          </Article>

          <Article n="2" title="모집 인원">
            <p>
              2027학년도 수시모집 총 모집인원은 <strong>1,842명</strong>이다. 전형별
              인원은 아래와 같으며,{" "}
              <strong>모집단위(학과)별 인원은 붙임1 「모집단위별_모집인원.xlsx」</strong>
              를 따른다. 본 공고문에는 학과별 인원을 싣지 않는다.
            </p>
            <NoticeTable
              head={["전형 유형", "전형명", "모집인원"]}
              rows={[
                ["학생부교과", "교과성적우수자", 612],
                ["학생부교과", "지역인재", 208],
                ["학생부종합", "이지인재", 486],
                ["학생부종합", "기회균형", 96],
                ["논술", "논술우수자", 274],
                ["실기·실적", "실기우수자", 166],
              ]}
            />
          </Article>

          <Article n="3" title="전형 방법">
            <NoticeTable
              head={["전형명", "1단계", "2단계", "면접", "논술"]}
              rows={[
                ["교과성적우수자", "학생부 교과 100%", "-", "없음", "없음"],
                ["지역인재", "학생부 교과 100%", "-", "없음", "없음"],
                ["이지인재", "서류 100% (3배수)", "1단계 70% + 면접 30%", "있음", "없음"],
                ["기회균형", "서류 100% (3배수)", "1단계 70% + 면접 30%", "있음", "없음"],
                ["논술우수자", "논술 70% + 교과 30%", "-", "없음", "있음"],
                ["실기우수자", "실기 60% + 교과 40%", "-", "없음", "없음"],
              ]}
            />
          </Article>

          <Article n="4" title="수능 최저학력기준">
            <NoticeTable
              head={["전형명", "기준"]}
              rows={[
                ["교과성적우수자", "국어·수학·영어·탐구(1) 중 2개 영역 등급 합 6 이내"],
                ["지역인재", "2개 영역 등급 합 7 이내"],
                ["이지인재 / 기회균형", "적용하지 않음"],
                ["논술우수자", "2개 영역 등급 합 5 이내"],
                ["실기우수자", "적용하지 않음"],
              ]}
            />
            <p className="text-neutral-500">
              ※ 의예과·약학과는 위 기준과 별도로 4개 영역 등급 합 5 이내를 충족해야 한다.
            </p>
          </Article>

          <Article n="5" title="복수지원 제한">
            <p>
              수시모집은 전국 기준 최대 <strong>6회</strong>까지 지원할 수 있다. 본교
              내에서는 전형 간 중복 지원이 가능하나{" "}
              <strong>동일 전형 내 복수 모집단위 지원은 불가</strong>하다. 이지인재와
              기회균형은 상호 중복 지원할 수 없다.
            </p>
          </Article>

          <Article n="6" title="제출 서류 및 전형료">
            <NoticeTable
              head={["전형명", "제출 서류", "전형료"]}
              rows={[
                ["교과성적우수자", "없음 (학생부 온라인 연계)", "45,000원"],
                ["지역인재", "없음", "45,000원"],
                ["이지인재", "자기소개서 (붙임3 지정서식 HWP)", "65,000원"],
                ["기회균형", "자기소개서 + 자격 증빙", "면제"],
                ["논술우수자", "없음", "70,000원"],
                ["실기우수자", "실기 경력 증빙", "85,000원"],
              ]}
            />
            <p className="text-neutral-500">
              ※ 자기소개서는 지정서식(HWP)으로만 받는다. 공인어학성적·교외 수상실적·부모
              직업을 기재하면 서류 평가 0점 처리한다.
            </p>
          </Article>

          <Article n="7" title="전형 일정">
            <p>
              1단계 발표일, 면접·논술 고사일, 최종 발표일은 전형마다 다르다. 상세 일정은{" "}
              <strong>붙임2 「전형일정.xlsx」</strong>를 따른다.
            </p>
          </Article>

          <AttachmentList slug={site.slug} files={files} />

          <section className="mt-10 border-y border-neutral-200 py-5 text-[13px] leading-[1.85] text-neutral-700">
            <h2 className="font-bold text-neutral-900">원서접수</h2>
            <p className="mt-2">
              접수는{" "}
              <Link
                href="/demo/easy-univ/apply"
                className={`font-semibold underline underline-offset-4 ${site.accentText}`}
              >
                본교 원서접수 시스템
              </Link>
              에서만 가능하며 회원가입 후 로그인해야 접수 화면이 열린다.
            </p>
          </section>
        </div>

        <div className="grid gap-4 self-start">
          <SideBox
            title="요강 요약"
            accent={site.accent}
            rows={[
              { label: "모집인원", value: "1,842명" },
              { label: "접수", value: "9.9 ~ 9.11 18:00" },
              { label: "학과별 인원", value: "붙임1 XLSX 참조" },
              { label: "전형 일정", value: "붙임2 XLSX 참조" },
              { label: "문의", value: "054-000-0000" },
            ]}
          />
          <div className="rounded border border-neutral-200 p-4 text-[12px] leading-relaxed text-neutral-600">
            <p className="font-semibold text-neutral-800">모집단위를 못 정했다면</p>
            <p className="mt-1.5">
              단과대학별 학과 목록은 모집단위 안내에서, 인원은 붙임1 엑셀에서 확인하세요.
            </p>
            <Link
              href="/demo/easy-univ/majors"
              className={`mt-2 inline-block font-semibold underline underline-offset-4 ${site.accentText}`}
            >
              모집단위 안내 →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Schedule() {
  return (
    <>
      <div className="mt-4 border-b border-neutral-200 pb-6">
        <h1 className="text-[23px] leading-snug font-bold text-neutral-900">
          2027학년도 수시모집 전형일정 및 고사 시간표 안내
        </h1>
        <p className="mt-2 text-[12px] text-neutral-500">
          입학처 · 2026-08-20 등록 · 조회 22,140
        </p>
      </div>

      <div className="mt-8 max-w-3xl">
        <Article n="1" title="안내">
          <p>
            2027학년도 수시모집 전형별 일정을 아래와 같이 안내한다. 개별 통지는 하지
            않으며, 변경 사항은 본 게시물을 수정해 공지한다.
          </p>
        </Article>

        <Article n="2" title="공통 일정">
          <NoticeTable
            head={["단계", "일정"]}
            rows={[
              ["원서접수", "2026. 9. 9. 09:00 ~ 9. 11. 18:00"],
              ["서류제출 마감", "2026. 9. 15. 18:00"],
              ["최종 합격자 발표", "2026. 12. 11. 17:00"],
              ["합격자 등록", "2026. 12. 15. ~ 12. 17. 16:00"],
            ]}
          />
        </Article>

        <Article n="3" title="전형별 일정">
          <p>
            전형별 1단계 발표일과 면접·고사일은 <strong>첨부 「전형일정.xlsx」</strong>에
            표로 정리했다. 면접 집합 시간은 계열마다 다르므로 반드시 파일을 확인할 것.
          </p>
        </Article>

        <AttachmentList
          slug={site.slug}
          files={files.filter((f) => f.name === "전형일정.xlsx")}
        />

        <div className="mt-8">
          <Link
            href="/demo/easy-univ/notice/2027-susi"
            className={`text-[13px] font-semibold underline underline-offset-4 ${site.accentText}`}
          >
            ← 수시모집 요강으로
          </Link>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function EssayVenue() {
  return (
    <>
      <div className="mt-4 border-b border-neutral-200 pb-6">
        <h1 className="text-[23px] leading-snug font-bold text-neutral-900">
          논술고사 고사장 배정 및 유의사항 (2026-11-15)
        </h1>
        <p className="mt-2 text-[12px] text-neutral-500">
          입학처 · 2026-08-18 등록 · 조회 9,870
        </p>
      </div>

      <div className="mt-8 max-w-3xl">
        <Article n="1" title="고사 시간">
          <NoticeTable
            head={["계열", "입실 완료", "고사 시간", "고사장"]}
            rows={[
              ["인문", "08:30", "09:00 ~ 10:40", "인문관 1~7층"],
              ["자연", "13:30", "14:00 ~ 15:40", "공학관 2~6층"],
            ]}
          />
          <p className="text-neutral-500">
            ※ 입실 완료 시각 이후 도착하면 응시할 수 없다. 개인별 고사장은 고사 5일 전
            홈페이지에서 확인한다.
          </p>
        </Article>

        <Article n="2" title="지참물">
          <p>
            수험표, 신분증(주민등록증·여권·사진과 생년월일이 있는 학생증 중 1), 흑색 볼펜.
            연필·수정테이프·전자기기는 반입할 수 없다.
          </p>
        </Article>

        <Article n="3" title="유의사항">
          <p>
            논술우수자 전형은 수능 최저학력기준(2개 영역 등급 합 5 이내)을 충족해야 하며,
            논술고사에 응시하지 않으면 불합격 처리한다. 주차 공간이 없으므로 대중교통을
            이용할 것.
          </p>
        </Article>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 정시 예고 — 제목이 비슷해 잘못 들어오기 쉽다                          */
/* ------------------------------------------------------------------ */

function Jeongsi() {
  return (
    <>
      <div className="mt-4 border-b border-neutral-200 pb-6">
        <StateBadge label="예고" tone="closed" />
        <h1 className="mt-2 text-[23px] leading-snug font-bold text-neutral-900">
          2027학년도 정시모집 주요사항 예고
        </h1>
        <p className="mt-2 text-[12px] text-neutral-500">
          입학처 · 2026-08-14 등록 · 조회 15,980
        </p>
      </div>

      <div className="mt-6 rounded border border-neutral-300 bg-neutral-100 px-4 py-4 text-[13px] leading-relaxed text-neutral-700">
        <p className="font-semibold text-neutral-900">
          이 게시물은 정시모집 예고이며, 지금 접수 중인 전형이 아닙니다.
        </p>
        <p className="mt-1">
          수시모집 원서접수는{" "}
          <Link
            href="/demo/easy-univ/notice/2027-susi"
            className="font-semibold underline underline-offset-4"
          >
            2027학년도 수시모집 요강
          </Link>
          을 확인하세요. 정시 원서접수는 2026년 12월 30일 시작 예정입니다.
        </p>
      </div>

      <div className="mt-8 max-w-3xl">
        <Article n="1" title="정시 전형 개요 (예고)">
          <NoticeTable
            head={["군", "전형명", "모집인원(예정)", "수능 반영"]}
            rows={[
              ["가군", "일반전형", "482", "100%"],
              ["나군", "일반전형", "394", "100%"],
              ["다군", "실기전형", "128", "수능 40% + 실기 60%"],
            ]}
          />
        </Article>
        <Article n="2" title="유의">
          <p>
            위 내용은 예고이며 확정 요강은 2026년 11월 중 별도 공고한다. 수시모집에
            합격하면 등록 여부와 관계없이 정시모집에 지원할 수 없다.
          </p>
        </Article>
      </div>
    </>
  );
}
