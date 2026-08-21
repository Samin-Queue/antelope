import {
  ApplyCta,
  Article,
  DemoFooter,
  DemoHeader,
  NoticeHead,
  NoticeTable,
} from "../_lib/chrome";
import { getSite } from "../_lib/sites";

const site = getSite("scholarship");

export default function ScholarshipNotice() {
  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "재단소개" },
          { label: "장학사업", active: true },
          { label: "장학생 마당" },
          { label: "공지사항" },
        ]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <NoticeHead
          site={site}
          meta={[
            { label: "장학금명", value: "미래희망 성적우수 장학금" },
            { label: "선발인원", value: "60명 (신규 40명 / 계속 20명)" },
            { label: "지원금액", value: "학기당 등록금 전액 (연 2회 지급)" },
            { label: "신청기간", value: "2026.09.01(화) ~ 2026.09.30(수) 18:00" },
          ]}
        />

        <Article n="1" title="신청 자격">
          <p>
            국내 4년제 대학 재학생(휴학생 제외)으로서 직전 학기{" "}
            <strong>12학점 이상</strong>을 이수하고 평점평균{" "}
            <strong>4.5 만점 기준 3.5 이상</strong>인 자. 신입생은 직전 학기 성적이
            없으므로 신청할 수 없으며 2학기부터 신청 가능하다.
          </p>
          <p>
            학자금 지원구간(소득분위) <strong>8구간 이하</strong>여야 하며, 한국장학재단
            홈페이지에서 발급한 학자금 지원구간 통지서를 제출해야 한다. 국가장학금 Ⅰ유형과
            중복 수혜가 가능하나 타 재단 장학금과는 중복될 수 없다.
          </p>
        </Article>

        <Article n="2" title="선발 기준">
          <NoticeTable
            head={["평가항목", "반영 비율", "비고"]}
            rows={[
              ["직전 학기 성적", "50%", "평점평균 환산"],
              ["학자금 지원구간", "30%", "구간이 낮을수록 고득점"],
              ["지도교수 추천서", "10%", "1부 필수"],
              ["봉사·활동 실적", "10%", "최근 2년 이내"],
            ]}
          />
        </Article>

        <Article n="3" title="제출 서류">
          <NoticeTable
            head={["서류명", "발급처", "비고"]}
            rows={[
              ["성적증명서", "재학 대학", "직전 학기 포함, 발급 1개월 이내"],
              ["재학증명서", "재학 대학", "발급 1개월 이내"],
              ["학자금 지원구간 통지서", "한국장학재단", "당해 학기 기준"],
              ["지도교수 추천서", "지정양식", "밀봉 불필요, 스캔본 제출"],
              ["통장 사본", "본인 명의", "장학금 입금 계좌"],
            ]}
          />
        </Article>

        <Article n="4" title="신청 방법">
          <p>
            본 재단 홈페이지 <strong>회원가입 후 로그인</strong>하여 온라인으로만
            신청한다. 우편·방문·이메일 접수는 받지 않는다. 회원가입 시 입력한 이메일로
            인증을 완료해야 신청서 작성 화면이 열리며, 선발 결과도 해당 이메일로 통지된다.
          </p>
          <p>
            <strong>한 계정당 1회만 신청</strong>할 수 있고 제출 후 수정이 불가능하다.
            타인 명의로 가입하거나 계정을 공유한 사실이 확인되면 선발에서 제외된다.
          </p>
        </Article>

        <Article n="5" title="유의사항">
          <p>
            장학생으로 선발된 후 해당 학기에 휴학하거나 평점평균이 3.0 미만으로 하락한
            경우 장학금 지급이 중단되며, 이미 지급된 금액은 환수될 수 있다. 제출 서류의
            위·변조가 확인되면 선발 취소와 함께 향후 5년간 본 재단 장학사업 신청이
            제한된다.
          </p>
        </Article>

        <ApplyCta site={site} />
      </main>
      <DemoFooter site={site} />
    </>
  );
}
