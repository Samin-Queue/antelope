import {
  ApplyCta,
  Article,
  DemoFooter,
  DemoHeader,
  NoticeHead,
  NoticeTable,
} from "../_lib/chrome";
import { getSite } from "../_lib/sites";

const site = getSite("hiring");

export default function HiringNotice() {
  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "회사소개" },
          { label: "서비스" },
          { label: "채용", active: true },
          { label: "블로그" },
        ]}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <NoticeHead
          site={site}
          meta={[
            { label: "직무", value: "백엔드 엔지니어 (Server)" },
            { label: "고용형태", value: "정규직 (수습 3개월)" },
            { label: "근무지", value: "경상북도 포항시 남구 (본사)" },
            { label: "접수마감", value: "2026.09.05(토) 23:59 · 채용 시 조기 마감" },
          ]}
        />

        <Article n="1" title="이런 일을 합니다">
          <p>
            결제 도메인의 API 서버를 설계하고 운영합니다. 일 평균 200만 건의 트랜잭션을
            처리하는 시스템을 다루며, 장애 대응 온콜 로테이션에 참여합니다.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>정산 배치 파이프라인 개선 및 데이터 정합성 검증</li>
            <li>레거시 모놀리스의 점진적 모듈 분리</li>
            <li>사내 개발자를 대상으로 하는 내부 API 문서화</li>
          </ul>
        </Article>

        <Article n="2" title="자격 요건">
          <p>
            백엔드 개발 경력 <strong>3년 이상</strong>이며, JVM 또는 Node 계열 언어 중
            하나로 프로덕션 서비스를 운영한 경험이 있는 분. 관계형 데이터베이스의 인덱스와
            실행계획을 읽고 쿼리를 개선해본 경험이 필요합니다. 학력은 무관하나
            졸업예정자는 지원할 수 없습니다.
          </p>
        </Article>

        <Article n="3" title="이런 분이면 더 좋습니다">
          <p>
            대용량 트래픽 환경에서의 캐시 전략 설계 경험, Kubernetes 기반 배포 파이프라인
            운영 경험, 금융·결제 도메인 이해. 오픈소스 기여 이력이 있다면 링크를 함께
            제출해 주세요.
          </p>
        </Article>

        <Article n="4" title="전형 절차">
          <NoticeTable
            head={["단계", "내용", "소요"]}
            rows={[
              ["서류전형", "이력서 · 포트폴리오 검토", "약 1주"],
              ["과제전형", "실무 과제 (기한 5일, 예상 소요 6시간 내외)", "약 1주"],
              ["1차 면접", "직무 인터뷰 (온라인 가능)", "60~90분"],
              ["2차 면접", "컬처핏 인터뷰 (본사 대면)", "60분"],
              ["처우 협의", "레퍼런스 체크 후 오퍼", "약 3일"],
            ]}
          />
        </Article>

        <Article n="5" title="제출 서류">
          <p>
            이력서는 <strong>PDF 필수</strong>이며 파일 크기는 10MB 를 넘을 수 없습니다.
            포트폴리오는 PDF 또는 링크(GitHub, 개인 블로그, Notion) 중 하나 이상을
            제출해야 하며, 비공개 저장소 링크는 열람이 불가하므로 접근 권한을 열어두시기
            바랍니다.
          </p>
          <p>
            자기소개서는 지원 시스템에 직접 작성합니다. 별도 파일 첨부로 대체할 수 없으며
            <strong>500자 이상 2000자 이내</strong>로 작성해 주세요.
          </p>
        </Article>

        <Article n="6" title="처우 및 복리후생">
          <p>
            연봉은 경력과 역량에 따라 협의하며 전년도 기준 백엔드 3~5년차 입사자의
            계약연봉 중앙값은 6,200만원입니다. 이 외 도서구입비 무제한, 장비 선택권, 연
            2회 리프레시 휴가를 제공합니다.
          </p>
        </Article>

        <ApplyCta site={site} />
      </main>
      <DemoFooter site={site} />
    </>
  );
}
