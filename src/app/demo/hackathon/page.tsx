import {
  ApplyCta,
  Article,
  DemoFooter,
  DemoHeader,
  NoticeHead,
  NoticeTable,
} from "../_lib/chrome";
import { getSite } from "../_lib/sites";

const site = getSite("hackathon");

export default function HackathonNotice() {
  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "공모전 소개" },
          { label: "접수", active: true },
          { label: "역대 수상작" },
          { label: "FAQ" },
        ]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <NoticeHead
          site={site}
          meta={[
            { label: "주최", value: "오픈이노베이션 챌린지 운영사무국" },
            { label: "주제", value: "공공데이터를 활용한 지역문제 해결" },
            { label: "접수마감", value: "2026.09.26(토) 12:00 (KST)" },
            { label: "총 상금", value: "3,000만원 (대상 1,500만원)" },
          ]}
        />

        <Article n="1" title="참가 자격">
          <p>
            국적·연령 제한 없이 누구나 참가할 수 있다. 팀은{" "}
            <strong>1인 이상 5인 이하</strong>로 구성하며, 팀장은 반드시 접수 계정의
            소유자여야 한다. 한 사람이 둘 이상의 팀에 중복으로 소속될 수 없으며, 중복이
            확인되면 해당 인원이 포함된 모든 팀이 실격된다.
          </p>
        </Article>

        <Article n="2" title="제출물 규격">
          <NoticeTable
            head={["제출물", "형식", "제한", "필수"]}
            rows={[
              ["기획서", "PDF", "10페이지 이내 · 20MB 이하", "필수"],
              ["시연 영상", "MP4 링크 (YouTube 비공개 링크 허용)", "3분 이내", "필수"],
              ["소스코드", "GitHub 저장소 URL", "공개 저장소만 인정", "필수"],
              ["데모 URL", "배포된 서비스 주소", "-", "선택"],
              ["발표자료", "PDF 또는 PPTX", "50MB 이하", "선택"],
            ]}
          />
          <p className="text-neutral-500">
            ※ 압축파일(.zip, .rar)로 묶어 제출한 경우 심사 대상에서 제외한다. 각 항목을
            지정된 형식으로 개별 제출해야 한다.
          </p>
        </Article>

        <Article n="3" title="심사 기준">
          <NoticeTable
            head={["항목", "설명", "배점"]}
            rows={[
              ["문제 정의", "해결하려는 지역문제의 구체성과 근거", 20],
              ["데이터 활용", "공공데이터 활용의 깊이와 창의성", 30],
              ["완성도", "실제 동작 여부, 기술적 구현 수준", 25],
              ["확장 가능성", "지속 운영 및 타 지역 확산 가능성", 15],
              ["발표", "전달력", 10],
            ]}
          />
          <p>
            <strong>공공데이터를 최소 1종 이상 실제로 연동</strong>해야 하며, 화면만
            만들고 데이터를 연동하지 않은 출품작은 데이터 활용 항목에서 0점 처리한다.
          </p>
        </Article>

        <Article n="4" title="일정">
          <NoticeTable
            head={["단계", "일정"]}
            rows={[
              ["접수", "2026.09.01 ~ 09.26 12:00"],
              ["1차 서면심사 결과 발표", "2026.10.05"],
              ["본선 발표심사", "2026.10.17 (포항)"],
              ["시상식", "2026.10.17 현장"],
            ]}
          />
        </Article>

        <Article n="5" title="저작권 및 유의사항">
          <p>
            출품작의 저작권은 참가자에게 있으나, 주최 측은 홍보 목적으로 출품작의 명칭과
            개요를 사용할 수 있다. 타인의 저작물을 무단 사용하거나 기존 공모전 수상작을
            재출품한 사실이 확인되면 수상이 취소되고 상금은 환수된다.
          </p>
        </Article>

        <ApplyCta site={site} />
      </main>
      <DemoFooter site={site} />
    </>
  );
}
