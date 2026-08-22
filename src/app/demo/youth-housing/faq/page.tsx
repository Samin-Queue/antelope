import Link from "next/link";

import { DemoFooter } from "../../_lib/chrome";
import { Breadcrumb, Faq, PageTitle, PortalHeader } from "../../_lib/portal";
import { getSite } from "../../_lib/sites";

const site = getSite("youth-housing");

/**
 * 청약 FAQ.
 *
 * 공고문에 없는 조건이 여기 있다 — 청약통장 불필요, 계약금 10%, 대리 청약 불가,
 * 특별공급 탈락자의 일반공급 자동 편입. 공고문만 읽고 답하면 반은 틀린다.
 */
export default function YouthHousingFaq() {
  return (
    <>
      <PortalHeader
        site={site}
        nav={[
          { label: "공사소개" },
          { label: "임대주택", href: "/demo/youth-housing" },
          { label: "청약안내", href: "/demo/youth-housing/faq", active: true },
          { label: "고객지원" },
        ]}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
        <Breadcrumb items={["홈", "청약안내", "자주 묻는 질문"]} />
        <div className="mt-4">
          <PageTitle
            site={site}
            title="자주 묻는 질문"
            desc="공고문에 담기 어려운 세부 조건을 모았습니다. 공고문과 다른 내용이 있으면 공고문이 우선합니다."
          />
        </div>

        <Faq
          items={[
            {
              tag: "자격",
              q: "청약통장이 있어야 신청할 수 있나요?",
              a: (
                <p>
                  아닙니다. 공공지원민간임대는 청약통장 순위를 보지 않습니다.
                  청년·신혼부부·고령자
                  <strong>
                    {" "}
                    모든 유형에서 청약통장 가입 여부를 확인하지 않습니다.
                  </strong>{" "}
                  가입되어 있어도 가점이 붙지 않습니다.
                </p>
              ),
            },
            {
              tag: "자격",
              q: "무주택 기준은 세대 전체인가요, 본인만인가요?",
              a: (
                <p>
                  <strong>신청자 본인 기준</strong>입니다. 부모님이 주택을 소유하고 있어도
                  신청자 본인이 무주택이면 신청할 수 있습니다. 다만 신청자 본인이
                  분양권·입주권을 보유한 경우에는 주택을 소유한 것으로 봅니다.
                </p>
              ),
            },
            {
              tag: "자격",
              q: "재직 중이 아니어도 신청할 수 있나요?",
              a: (
                <p>
                  가능합니다. 소득이 없으면 월평균소득 0원으로 산정합니다. 다만 취업준비생
                  가점(2점)을 신청하려면 최근 1년 이내 구직활동 증빙이 필요합니다.
                </p>
              ),
            },
            {
              tag: "신청",
              q: "특별공급에 떨어지면 일반공급은 따로 신청해야 하나요?",
              a: (
                <p>
                  따로 신청하지 않습니다. 특별공급 탈락자는{" "}
                  <strong>별도 신청 없이 일반공급 추첨에 자동으로 포함</strong>됩니다. 두
                  번 신청하면 중복 접수로 둘 다 무효 처리됩니다.
                </p>
              ),
            },
            {
              tag: "신청",
              q: "주택형을 두 개 고를 수 있나요?",
              a: (
                <p>
                  1순위와 2순위까지 고를 수 있습니다. 1순위에서 탈락하면 2순위 잔여 세대를
                  대상으로 한 번 더 추첨합니다. 3순위 이상은 받지 않습니다.
                </p>
              ),
            },
            {
              tag: "신청",
              q: "가족이 대신 신청해도 되나요?",
              a: (
                <p>
                  <strong>대리 청약은 인정하지 않습니다.</strong> 본인 명의 휴대폰 인증을
                  거쳐야 접수됩니다. 계약 단계에서는 위임장과 인감증명서를 갖추면 대리
                  계약이 가능합니다.
                </p>
              ),
            },
            {
              tag: "일정",
              q: "접수 시작일이 언제인가요?",
              a: (
                <p>
                  홈페이지에는 단지별 일정을 따로 게시하지 않습니다. 공고 상세 화면의 붙임
                  <strong> 「공급일정표」(XLSX)</strong>에 특별공급·일반공급 접수 시각이
                  나뉘어 있으니 그 파일을 확인하세요. 공고문 본문과 다르면 붙임이
                  우선합니다.
                </p>
              ),
            },
            {
              tag: "일정",
              q: "마감 시각에 접속이 안 되면 연장되나요?",
              a: <p>연장되지 않습니다. 마감 5분 전까지 제출을 마치시기 바랍니다.</p>,
            },
            {
              tag: "서류",
              q: "청약신청서를 워드로 작성해도 되나요?",
              a: (
                <p>
                  안 됩니다. 붙임2 지정서식(HWP)으로만 받습니다. 파일명은
                  「청약신청서_성명_주택형」 형식이어야 하며 규칙을 어기면 업로드 단계에서
                  거부됩니다.
                </p>
              ),
            },
            {
              tag: "서류",
              q: "서류는 언제 내나요?",
              a: (
                <p>
                  접수 시점에는 청약신청서만 올립니다. 나머지 증빙은{" "}
                  <strong>서류제출대상자로 선정된 뒤</strong> 별도 기간에 제출합니다. 그
                  기간도 붙임3 「공급일정표」에 있습니다.
                </p>
              ),
            },
            {
              tag: "계약",
              q: "계약금은 얼마인가요?",
              a: (
                <p>
                  임대보증금의 <strong>10%</strong>입니다. 잔금은 입주지정기간 개시일
                  전까지 납부합니다.
                </p>
              ),
            },
            {
              tag: "계약",
              q: "보증금을 올리고 월세를 낮출 수 있나요?",
              a: (
                <p>
                  가능합니다. 전환 비율은 연 5.2%, 보증금 최대 전환 한도는 표준 보증금의
                  200%입니다. 신청 화면에서 희망 여부만 표시하고 실제 전환은 계약 시
                  확정합니다.
                </p>
              ),
            },
          ]}
        />

        <div className="mt-10 rounded border border-neutral-200 bg-neutral-50 px-4 py-4 text-[13px] text-neutral-600">
          찾는 답이 없으면 청약센터 054-000-0000 으로 문의하세요.{" "}
          <Link
            href="/demo/youth-housing/notice/2026-0087"
            className={`font-semibold underline underline-offset-4 ${site.accentText}`}
          >
            모집공고 다시 보기
          </Link>
        </div>
      </main>
      <DemoFooter site={site} />
    </>
  );
}
