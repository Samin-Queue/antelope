import {
  ApplyCta,
  Article,
  DemoFooter,
  DemoHeader,
  NoticeHead,
  NoticeTable,
} from "../_lib/chrome";
import { getSite } from "../_lib/sites";

const site = getSite("permit");

export default function PermitNotice() {
  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "민원안내" },
          { label: "온라인신청", active: true },
          { label: "처리현황" },
          { label: "서식자료실" },
        ]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <NoticeHead
          site={site}
          meta={[
            { label: "민원사무명", value: "일반음식점 영업신고" },
            {
              label: "근거법령",
              value: "식품위생법 제37조제4항, 같은 법 시행규칙 제42조",
            },
            { label: "처리기간", value: "3일 (토·공휴일 제외)" },
            { label: "수수료", value: "28,000원" },
          ]}
        />

        <Article n="1" title="신고 대상">
          <p>
            음식류를 조리·판매하면서 식사와 함께 부수적으로 음주행위가 허용되는 영업을
            하려는 자는 영업개시 전에 관할 시·군·구청에 신고하여야 한다. 신고하지 않고
            영업한 경우 3년 이하의 징역 또는 3천만원 이하의 벌금에 처해질 수 있다.
          </p>
        </Article>

        <Article n="2" title="구비 서류">
          <p>
            아래 서식은 <strong>본 시스템에서 배포하는 지정서식만 인정</strong>한다.
            서식자료실에서 내려받아 한글(HWP)로 작성한 뒤{" "}
            <strong>HWP 또는 HWPX 파일 그대로</strong> 제출해야 하며, PDF·이미지로
            변환하여 제출한 경우 접수되지 않는다.
          </p>
          <NoticeTable
            head={["서식", "서류명", "파일명 규칙", "필수"]}
            rows={[
              ["서식1", "영업신고서", "[서식1]영업신고서_상호명.hwp", "필수"],
              [
                "서식2",
                "위생교육 이수증명서",
                "[서식2]위생교육이수증_대표자명.hwp",
                "필수",
              ],
              ["서식3", "영업장 시설 배치도", "[서식3]시설배치도_상호명.hwp", "필수"],
              ["-", "건강진단결과서(보건증)", "스캔 이미지 또는 PDF 허용", "필수"],
              ["-", "임대차계약서 사본", "스캔 이미지 또는 PDF 허용", "해당 시"],
            ]}
          />
          <p className="text-neutral-500">
            ※ 파일명 규칙을 지키지 않으면 시스템이 자동으로 반려한다. 대괄호와 서식번호를
            포함해야 하며 공백을 넣지 않는다.
          </p>
        </Article>

        <Article n="3" title="처리 절차">
          <NoticeTable
            head={["순서", "단계", "담당"]}
            rows={[
              ["1", "온라인 신고서 및 서식 제출", "신고인"],
              ["2", "전자서명 (공동인증서)", "신고인"],
              ["3", "수수료 납부", "신고인"],
              ["4", "서류 검토 및 현장 확인", "위생민원과"],
              ["5", "영업신고증 교부", "위생민원과"],
            ]}
          />
          <p>
            전자서명과 수수료 납부가 모두 완료된 시점에 접수가 확정된다. 어느 하나라도
            누락되면 제출한 서류는 7일 후 자동 폐기된다.
          </p>
        </Article>

        <Article n="4" title="유의사항">
          <p>
            위생교육은 영업개시 전에 이수하여야 하며, 이수한 지{" "}
            <strong>2년이 지난 교육</strong>은 인정되지 않는다. 영업장이 건축물대장상
            근린생활시설이 아닌 경우 용도변경이 선행되어야 하고, 이 경우 본 신고는
            반려된다.
          </p>
        </Article>

        <ApplyCta site={site} />
      </main>
      <DemoFooter site={site} />
    </>
  );
}
