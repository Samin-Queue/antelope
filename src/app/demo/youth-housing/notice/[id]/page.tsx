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

const site = getSite("youth-housing");
const files = filesFor(site.slug);

const IDS = ["2026-0087", "2026-0087-1", "2026-0071"] as const;
type NoticeId = (typeof IDS)[number];

export function generateStaticParams() {
  return IDS.map((id) => ({ id }));
}

export default async function YouthHousingNotice(
  props: PageProps<"/demo/youth-housing/notice/[id]">,
) {
  const { id } = await props.params;
  if (!IDS.includes(id as NoticeId)) notFound();

  return (
    <>
      <PortalHeader
        site={site}
        nav={[
          { label: "공사소개" },
          { label: "임대주택", href: "/demo/youth-housing", active: true },
          { label: "청약안내", href: "/demo/youth-housing/faq" },
          { label: "고객지원" },
        ]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        <Breadcrumb items={["홈", "임대주택", "공고·공지사항", "상세"]} />
        {id === "2026-0087" && <MainNotice />}
        {id === "2026-0087-1" && <Correction />}
        {id === "2026-0071" && <ClosedNotice />}
      </main>
      <DemoFooter site={site} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 본 공고 — 데모의 목적지                                              */
/* ------------------------------------------------------------------ */

function MainNotice() {
  return (
    <>
      <div className="mt-4 border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge label="접수예정" tone="soon" />
          <span className={`text-[11px] font-semibold ${site.accentText}`}>
            공공지원민간임대
          </span>
        </div>
        <h1 className="mt-2 text-[23px] leading-snug font-bold text-neutral-900">
          역세권 청년안심주택 「한빛스테이 장량」 공공지원민간임대 입주자 모집공고
        </h1>
        <p className="mt-2 text-[12px] text-neutral-500">
          주거복지처 · 2026-08-24 등록 · 조회 3,126
        </p>
        <TriggerBar site={site} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_240px]">
        <div>
          <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
            2026-08-28 자로 일부 내용이 정정되었습니다.{" "}
            <Link
              href="/demo/youth-housing/notice/2026-0087-1"
              className="font-semibold underline underline-offset-4"
            >
              정정공고 보기
            </Link>
            . 정정된 항목은 정정공고가 우선합니다.
          </div>

          <Article n="1" title="공급 개요">
            <NoticeTable
              head={["구분", "내용"]}
              rows={[
                ["단지명", "한빛스테이 장량 (포항시 북구 장량동 000-0)"],
                ["규모", "지하 3층 ~ 지상 18층 · 1개동 · 412세대"],
                ["공급유형", "공공지원민간임대 (특별공급 124 / 일반공급 288)"],
                ["임대 의무기간", "8년"],
                ["입주 예정", "2027년 3월 (예정)"],
              ]}
            />
          </Article>

          <Article n="2" title="주택형별 공급 호수 및 임대조건">
            <NoticeTable
              head={["주택형", "전용면적", "총 세대", "임대보증금", "월임대료"]}
              rows={[
                ["16A", "16.98㎡", 96, "21,000,000원", "197,000원"],
                ["19B", "19.44㎡", 128, "26,400,000원", "241,000원"],
                ["24C", "24.36㎡", 114, "33,800,000원", "312,000원"],
                ["31D", "31.72㎡", 74, "44,100,000원", "408,000원"],
              ]}
            />
            <p className="text-neutral-500">
              ※ 층·향별 가산과 보증금 전환 조건은 붙임1 「입주자모집공고문 전문」을
              따른다.
            </p>
          </Article>

          <Article n="3" title="신청 자격">
            <p>
              공고일(2026.08.24) 현재 <strong>무주택자</strong>로서 아래 유형 중 하나에
              해당해야 한다. 세대가 아니라 <strong>신청자 본인 기준</strong>이다.
            </p>
            <NoticeTable
              head={["유형", "연령·혼인", "소득 기준", "자산 기준"]}
              rows={[
                [
                  "청년",
                  "만 19~39세 · 미혼",
                  "도시근로자 월평균소득 120% 이하",
                  "총자산 2억 7,300만원 이하",
                ],
                [
                  "신혼부부",
                  "혼인 7년 이내 또는 예비신혼부부",
                  "130% 이하 (맞벌이 140%)",
                  "총자산 3억 3,700만원 이하",
                ],
                ["고령자", "만 65세 이상", "100% 이하", "총자산 3억 3,700만원 이하"],
              ]}
            />
            <p className="text-neutral-500">
              ※ 가구원 수별 소득 금액은 붙임4 「소득·자산 기준표」의 표를 적용한다. 본
              공고문에는 금액을 싣지 않는다.
            </p>
          </Article>

          <Article n="4" title="청약 일정">
            <p>
              특별공급과 일반공급의 접수 개시·마감 시각, 서류제출 기간, 당첨자 발표일은{" "}
              <strong>붙임3 「공급일정표」</strong>에 따른다. 본 공고문의 다른 기재와 다를
              경우 붙임3 이 우선한다.
            </p>
            <p className="text-neutral-500">
              ※ 접수는 온라인으로만 받으며, 마감 시각 이후에는 어떠한 사유로도 접수·수정이
              불가하다.
            </p>
          </Article>

          <Article n="5" title="제출 서류">
            <NoticeTable
              head={["서류", "제출 방식", "필수 여부"]}
              rows={[
                ["청약신청서", "붙임2 지정서식(HWP)으로만 제출", "필수"],
                ["주민등록표 등본", "발급 1개월 이내", "필수"],
                ["소득 증빙 (소득금액증명 등)", "최근 1개년", "필수"],
                ["가족관계증명서(상세)", "신혼부부·고령자 유형", "조건부"],
                ["재직증명서", "사회초년생 가점 신청자", "조건부"],
              ]}
            />
            <p className="text-neutral-500">
              ※ 청약신청서 파일명은 「청약신청서_성명_주택형」 형식으로 한다. 자유양식으로
              제출한 경우 검토 없이 반려된다.
            </p>
          </Article>

          <Article n="6" title="유의사항">
            <p>
              입력한 소득·자산은 사회보장정보시스템으로 사후 검증한다. 사실과 다를 경우
              당첨이 취소되고 향후 2년간 본 공사 공급주택 청약이 제한된다.{" "}
              <strong>대리 청약은 인정하지 않는다.</strong>
            </p>
          </Article>

          <AttachmentList slug={site.slug} files={files} />

          <section className="mt-10 border-y border-neutral-200 py-5 text-[13px] leading-[1.85] text-neutral-700">
            <h2 className="font-bold text-neutral-900">청약 신청</h2>
            <p className="mt-2">
              신청은 아래 온라인 청약 신청 페이지에서만 접수한다. 접수 기간은 붙임3
              「공급일정표」를 확인할 것.
            </p>
            <p className={`mt-2 font-semibold break-all ${site.accentText}`}>
              {"신청 링크: https://antelope.up.railway.app/demo/youth-housing/apply"}
            </p>
          </section>
        </div>

        <div className="grid gap-4 self-start">
          <SideBox
            title="공고 요약"
            accent={site.accent}
            rows={[
              { label: "공고번호", value: "2026-민간임대-0087" },
              { label: "공급 세대", value: "412세대" },
              { label: "접수 방법", value: "온라인 전용" },
              { label: "접수 일정", value: "붙임3 공급일정표 참조" },
              { label: "문의", value: "054-000-0000" },
            ]}
          />
          <div className="rounded border border-neutral-200 p-4 text-[12px] leading-relaxed text-neutral-600">
            <p className="font-semibold text-neutral-800">이 공고를 처음 보셨나요?</p>
            <p className="mt-1.5">
              청년 유형은 청약통장이 필요하지 않습니다. 자주 묻는 질문에서 확인하세요.
            </p>
            <Link
              href="/demo/youth-housing/faq"
              className={`mt-2 inline-block font-semibold underline underline-offset-4 ${site.accentText}`}
            >
              자주 묻는 질문 →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 정정공고                                                            */
/* ------------------------------------------------------------------ */

function Correction() {
  return (
    <>
      <div className="mt-4 border-b border-neutral-200 pb-6">
        <StateBadge label="정정" tone="soon" />
        <h1 className="mt-2 text-[23px] leading-snug font-bold text-neutral-900">
          [정정] 「한빛스테이 장량」 주택형별 공급호수 및 임대조건 일부 정정
        </h1>
        <p className="mt-2 text-[12px] text-neutral-500">
          주거복지처 · 2026-08-28 등록 · 조회 1,842
        </p>
      </div>

      <div className="mt-8 max-w-3xl">
        <p className="text-[13px] leading-[1.85] text-neutral-700">
          공고번호 2026-민간임대-0087 「한빛스테이 장량」 입주자모집공고의 아래 항목을
          정정합니다. 정정되지 않은 항목은 원 공고를 그대로 따릅니다.
        </p>

        <Article n="1" title="정정 내역">
          <NoticeTable
            head={["항목", "정정 전", "정정 후"]}
            rows={[
              ["24C 총 세대수", "114세대", "120세대"],
              ["31D 총 세대수", "74세대", "68세대"],
              ["19B 임대보증금", "26,400,000원", "25,900,000원"],
              ["일반공급 세대수", "288세대", "288세대 (변동 없음)"],
            ]}
          />
        </Article>

        <Article n="2" title="정정 사유">
          <p>
            사업계획 변경 승인에 따라 24C 형 6세대가 증가하고 31D 형 6세대가 감소하였으며,
            19B 형은 표준임대료 산정 오류를 바로잡았습니다.
          </p>
        </Article>

        <Article n="3" title="일정 변경 여부">
          <p>
            <strong>청약 일정은 변경되지 않습니다.</strong> 접수 개시·마감, 서류제출,
            당첨자 발표는 원 공고 붙임3 「공급일정표」를 그대로 따릅니다.
          </p>
        </Article>

        <div className="mt-8">
          <Link
            href="/demo/youth-housing/notice/2026-0087"
            className={`text-[13px] font-semibold underline underline-offset-4 ${site.accentText}`}
          >
            ← 원 공고로 돌아가기
          </Link>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 마감된 다른 단지 — 제목이 비슷해 잘못 들어오기 쉽다                   */
/* ------------------------------------------------------------------ */

function ClosedNotice() {
  return (
    <>
      <div className="mt-4 border-b border-neutral-200 pb-6">
        <StateBadge label="접수마감" tone="closed" />
        <h1 className="mt-2 text-[23px] leading-snug font-bold text-neutral-900">
          역세권 청년안심주택 「새길스테이 죽도」 공공지원민간임대 입주자 모집공고
        </h1>
        <p className="mt-2 text-[12px] text-neutral-500">
          주거복지처 · 2026-06-15 등록 · 조회 9,021
        </p>
      </div>

      <div className="mt-6 rounded border border-neutral-300 bg-neutral-100 px-4 py-4 text-[13px] leading-relaxed text-neutral-700">
        <p className="font-semibold text-neutral-900">
          이 공고의 접수는 2026-07-10 17:00 에 종료되었습니다.
        </p>
        <p className="mt-1">
          현재 접수 중이거나 접수 예정인 공고는{" "}
          <Link
            href="/demo/youth-housing/notice/2026-0087"
            className="font-semibold underline underline-offset-4"
          >
            「한빛스테이 장량」 모집공고
          </Link>
          입니다.
        </p>
      </div>

      <div className="mt-8 max-w-3xl">
        <Article n="1" title="공급 개요">
          <NoticeTable
            head={["구분", "내용"]}
            rows={[
              ["단지명", "새길스테이 죽도 (포항시 남구 죽도동 000-0)"],
              ["규모", "지상 15층 · 1개동 · 268세대"],
              ["접수기간", "2026-07-06 09:00 ~ 2026-07-10 17:00 (종료)"],
              ["당첨자 발표", "2026-08-12 (완료)"],
            ]}
          />
        </Article>
        <Article n="2" title="안내">
          <p>
            예비입주자 순번은 공고 목록의 「예비입주자 순번 안내」 게시물에서 확인할 수
            있으며, 순번은 발표일로부터 1년간 유효합니다. 본 공고의 신청 페이지는 닫혀
            있습니다.
          </p>
        </Article>
      </div>
    </>
  );
}
