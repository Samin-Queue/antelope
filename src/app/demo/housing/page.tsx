import {
  ApplyCta,
  Article,
  DemoFooter,
  DemoHeader,
  NoticeHead,
  NoticeTable,
} from "../_lib/chrome";
import { getSite } from "../_lib/sites";

const site = getSite("housing");

export default function HousingNotice() {
  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "분양·임대", active: true },
          { label: "청약안내" },
          { label: "고객지원" },
          { label: "공사소개" },
        ]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <NoticeHead
          site={site}
          meta={[
            { label: "공고번호", value: "2026-임대-0087" },
            { label: "단지", value: "포항 장량 행복주택 (전용 16㎡ / 26㎡ / 36㎡)" },
            { label: "공급호수", value: "총 312호 (예비입주자 포함)" },
            { label: "청약기간", value: "2026.09.14(월) ~ 2026.09.19(토) 17:00" },
          ]}
        />

        <Article n="1" title="공급 개요">
          <NoticeTable
            head={["주택형", "공급호수", "보증금", "월임대료"]}
            rows={[
              ["16㎡", "84호", "9,800,000원", "78,000원"],
              ["26㎡", "150호", "16,400,000원", "131,000원"],
              ["36㎡", "78호", "24,900,000원", "198,000원"],
            ]}
          />
          <p className="text-neutral-500">
            ※ 보증금과 월임대료는 상호 전환이 가능하며 전환 비율은 계약 시 안내한다.
          </p>
        </Article>

        <Article n="2" title="신청 자격">
          <p>
            공고일 현재 <strong>무주택세대구성원</strong>으로서 아래 계층 중 하나에
            해당해야 한다. 세대구성원 전원이 무주택이어야 하며, 분양권·입주권을 보유한
            경우에도 주택을 소유한 것으로 본다.
          </p>
          <NoticeTable
            head={["계층", "요건", "소득 기준", "자산 기준"]}
            rows={[
              [
                "청년",
                "만 19~39세 · 미혼 · 무주택자",
                "도시근로자 월평균소득 120% 이하",
                "총자산 2억 7천만원 이하",
              ],
              [
                "신혼부부",
                "혼인 7년 이내 또는 예비신혼부부",
                "월평균소득 130% 이하 (맞벌이 140%)",
                "총자산 3억 4천만원 이하",
              ],
              [
                "고령자",
                "만 65세 이상 무주택세대구성원",
                "월평균소득 100% 이하",
                "총자산 3억 4천만원 이하",
              ],
              [
                "주거급여수급자",
                "주거급여 수급 중인 무주택세대구성원",
                "별도 적용",
                "별도 적용",
              ],
            ]}
          />
          <p className="text-neutral-500">
            ※ 자동차 가액이 3,803만원을 초과하는 경우 계층과 무관하게 신청할 수 없다.
          </p>
        </Article>

        <Article n="3" title="순위 및 가점">
          <p>
            동일 순위 내 경쟁이 있는 경우 아래 가점 합계가 높은 순으로 선정하며, 가점이
            같으면 추첨한다. <strong>가점 상한은 12점</strong>이다.
          </p>
          <NoticeTable
            head={["가점 항목", "배점 기준", "점수"]}
            rows={[
              ["해당 지역 거주기간", "1년 미만 / 1~3년 / 3년 이상", "1 / 2 / 3"],
              ["무주택 기간", "1년 미만 / 1~3년 / 3년 이상", "1 / 2 / 3"],
              ["청약저축 납입 횟수", "6회 미만 / 6~23회 / 24회 이상", "0 / 1 / 2"],
              ["부양가족 수", "1명당 1점 (최대 2점)", "0~2"],
              ["사회초년생·취업준비생", "해당 시", "2"],
            ]}
          />
        </Article>

        <Article n="4" title="유의사항">
          <p>
            신청 시 입력한 소득·자산 정보는 사회보장정보시스템을 통해 사후 검증되며,
            사실과 다른 경우 당첨이 취소되고 향후 2년간 본 공사 공급주택 청약이 제한된다.
            세대구성원 정보는 주민등록표등본을 기준으로 하며 실제와 다르게 기재해서는 안
            된다.
          </p>
        </Article>

        <ApplyCta site={site} />
      </main>
      <DemoFooter site={site} />
    </>
  );
}
