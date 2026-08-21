import {
  ApplyCta,
  Article,
  DemoFooter,
  DemoHeader,
  NoticeHead,
  NoticeTable,
} from "../_lib/chrome";
import { getSite } from "../_lib/sites";

const site = getSite("cert-exam");

export default function CertExamNotice() {
  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "자격안내" },
          { label: "원서접수", active: true },
          { label: "합격조회" },
          { label: "고객센터" },
        ]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <NoticeHead
          site={site}
          meta={[
            { label: "시행회차", value: "제38회 (2026년 3차)" },
            { label: "검정종목", value: "정보처리 실무능력 검정 1급 / 2급" },
            { label: "접수기간", value: "2026.08.24(월) 09:00 ~ 2026.08.29(토) 18:00" },
            { label: "시험일", value: "2026.09.20(일) · 고사장별 교시 상이" },
          ]}
        />

        <Article n="1" title="응시 자격">
          <p>
            2급은 응시 자격에 제한이 없다. 1급은 다음 중 하나를 충족해야 하며, 자격 확인이
            되지 않으면 접수가 취소되고 응시료는 반환하지 않는다.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>본 검정 2급 취득 후 실무경력 1년 이상</li>
            <li>관련 학과 전문학사 이상 졸업(예정) 또는 4학기 이상 이수</li>
            <li>동일 직무분야 실무경력 3년 이상</li>
          </ul>
        </Article>

        <Article n="2" title="검정 과목 및 시간">
          <NoticeTable
            head={["등급", "과목", "문항", "시험시간", "합격기준"]}
            rows={[
              [
                "2급",
                "정보기술 기초 / 데이터 활용",
                "60",
                "80분",
                "과목당 40점 이상, 평균 60점 이상",
              ],
              [
                "1급",
                "시스템 설계 / 데이터베이스 / 실무 서술",
                "45 + 서술 3",
                "120분",
                "과목당 40점 이상, 평균 60점 이상",
              ],
            ]}
          />
        </Article>

        <Article n="3" title="응시료 및 납부">
          <NoticeTable
            head={["등급", "응시료", "비고"]}
            rows={[
              ["2급", "24,000원", "-"],
              ["1급", "38,000원", "-"],
              ["재응시 할인", "정가의 50%", "직전 회차 불합격자에 한함"],
            ]}
          />
          <p className="text-neutral-500">
            ※ 접수는 응시료 결제가 완료된 시점에 확정된다. 결제하지 않고 대기 상태로 둔
            접수는 마감과 동시에 자동 취소된다.
          </p>
        </Article>

        <Article n="4" title="증명사진 규격">
          <p>
            최근 6개월 이내 촬영한 <strong>탈모 상반신</strong> 사진으로, 가로 3.5cm ×
            세로 4.5cm 비율이어야 한다. 파일 형식은 JPG 또는 PNG, 용량은{" "}
            <strong>2MB 이하</strong>다. 배경에 무늬가 있거나 모자·선글라스를 착용한 사진,
            셀프 촬영 사진은 반려된다.
          </p>
        </Article>

        <Article n="5" title="고사장">
          <NoticeTable
            head={["지역", "고사장", "수용 인원"]}
            rows={[
              ["경북 포항", "포항정보고등학교 / 포항제철중학교", "320 / 260"],
              ["경북 구미", "구미전자정보고등학교", "400"],
              ["대구", "대구소프트웨어마이스터고 / 경명여자고등학교", "380 / 300"],
              ["서울", "선린인터넷고등학교 / 한강미디어고등학교", "520 / 410"],
            ]}
          />
          <p className="text-neutral-500">
            ※ 고사장은 선착순 배정되며 정원이 마감되면 선택 목록에서 사라진다. 접수 후
            고사장 변경은 불가하다.
          </p>
        </Article>

        <ApplyCta site={site} />
      </main>
      <DemoFooter site={site} />
    </>
  );
}
