import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이지대학교 2027 수시모집 안내",
  robots: { index: false, follow: false },
};

/**
 * 홍보 이미지 원본. `/demo/easy-univ/poster.png` 가 이 화면을 찍는다.
 *
 * 대학 포스터가 실제로 그렇듯 **모집인원과 학과별 정보를 싣지 않는다.** 접수
 * 기간과 주소만 크게 적고, 나머지는 「요강 확인」으로 넘긴다.
 */
export default function EasyUnivPoster() {
  return (
    <div className="h-[1350px] w-[1080px] overflow-hidden bg-[#f6f4ee]">
      <div className="flex h-full flex-col">
        <div className="bg-[#00563f] px-[76px] py-[54px] text-white">
          <div className="flex items-center gap-4">
            <span className="flex size-[54px] items-center justify-center rounded-full bg-white text-[24px] font-black text-[#00563f]">
              E
            </span>
            <span className="leading-tight">
              <span className="block text-[27px] font-bold">이지대학교</span>
              <span className="block text-[13px] tracking-[0.3em] text-white/60 uppercase">
                Easy University
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col px-[76px] py-[64px]">
          <p className="text-[27px] font-semibold tracking-[0.3em] text-[#00563f]">
            2027학년도
          </p>
          <h1 className="mt-[16px] text-[112px] leading-[1.02] font-black tracking-tight text-[#122b22]">
            수시모집
          </h1>
          <p className="mt-[26px] text-[34px] font-medium text-[#3c5148]">
            7개 단과대학 29개 모집단위 · 총 1,842명
          </p>

          <div className="mt-[52px] rounded-xl bg-[#00563f] px-[40px] py-[38px] text-white">
            <p className="text-[24px] tracking-wide text-white/70">원서접수</p>
            <p className="mt-[10px] text-[52px] leading-tight font-black">
              2026. 9. 9.(수) 09:00
              <br />~ 9. 11.(금) 18:00
            </p>
            <p className="mt-[16px] text-[22px] text-white/75">
              인터넷 접수만 가능 · 마감 후 접수·수정 불가
            </p>
          </div>

          <div className="mt-[44px] grid grid-cols-3 gap-[16px]">
            {[
              ["학생부교과", "교과성적우수자 · 지역인재"],
              ["학생부종합", "이지인재 · 기회균형"],
              ["논술 · 실기", "논술우수자 · 실기우수자"],
            ].map(([head, body]) => (
              <div
                key={head}
                className="rounded-lg border-2 border-[#00563f]/25 bg-white px-[24px] py-[26px]"
              >
                <p className="text-[27px] font-bold text-[#00563f]">{head}</p>
                <p className="mt-[10px] text-[19px] leading-snug text-[#4a5f56]">
                  {body}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-[40px] text-[24px] leading-relaxed text-[#3c5148]">
            <strong>모집단위별 인원·전형일정은 수시모집요강 붙임 파일</strong>에서
            확인하세요. 포스터에는 싣지 않습니다.
          </p>

          <div className="mt-auto border-t-2 border-[#00563f]/20 pt-[30px]">
            <p className="text-[25px] font-bold text-[#122b22]">
              이지대학교 입학처 054-000-0000
            </p>
            <p className="mt-[8px] font-mono text-[25px] tracking-tight text-[#00563f]">
              antelope.up.railway.app/demo/easy-univ
            </p>
            <p className="mt-[16px] text-[17px] text-[#6b7f76]">
              admission@easy.example · 본 이미지는 문서 에이전트 검증용으로 만든 가상
              대학의 홍보물입니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
