import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "한빛스테이 장량 입주자 모집 안내",
  robots: { index: false, follow: false },
};

/**
 * 홍보 이미지 원본. `/demo/youth-housing/poster.png` 가 이 화면을 그대로 찍는다.
 *
 * 포스터는 **날짜를 숨긴다.** 「9월 접수」까지만 적고 정확한 시각은 공고문 붙임에
 * 있다고 쓴다 — 이미지 한 장으로 시작한 에이전트가 사이트를 타고 들어가 엑셀을
 * 열어야만 답이 나오는 그 경로가 이 데모의 전부다.
 */
export default function YouthHousingPoster() {
  return (
    <div className="h-[1350px] w-[1080px] overflow-hidden bg-[#0b4f9e] text-white">
      <div className="flex h-full flex-col px-[76px] py-[80px]">
        <div className="flex items-center gap-4">
          <span className="flex size-[56px] items-center justify-center rounded-lg bg-white text-[26px] font-black text-[#0b4f9e]">
            새
          </span>
          <span className="leading-tight">
            <span className="block text-[26px] font-bold">새길주거공사</span>
            <span className="block text-[13px] tracking-[0.3em] text-white/60 uppercase">
              Saegil Housing
            </span>
          </span>
        </div>

        <p className="mt-[74px] text-[26px] font-semibold tracking-[0.4em] text-[#9ec8f2]">
          역세권 청년안심주택
        </p>
        <h1 className="mt-[18px] text-[104px] leading-[1.05] font-black tracking-tight">
          한빛스테이
          <br />
          장량
        </h1>
        <p className="mt-[30px] text-[34px] leading-snug font-medium text-white/85">
          보증금 2,100만원부터 · 월 19만원부터
          <br />
          임대 의무기간 8년 · 총 412세대
        </p>

        <div className="mt-[56px] grid grid-cols-4 gap-[14px]">
          {[
            ["16A", "16.98㎡", "96세대"],
            ["19B", "19.44㎡", "128세대"],
            ["24C", "24.36㎡", "120세대"],
            ["31D", "31.72㎡", "68세대"],
          ].map(([type, area, count]) => (
            <div key={type} className="rounded-lg bg-white/10 px-[18px] py-[22px]">
              <p className="text-[34px] font-black">{type}</p>
              <p className="mt-[6px] text-[19px] text-white/70">{area}</p>
              <p className="text-[19px] text-white/70">{count}</p>
            </div>
          ))}
        </div>

        <div className="mt-[52px] rounded-lg bg-white px-[34px] py-[30px] text-[#0b4f9e]">
          <p className="text-[22px] font-bold tracking-wide">청약 접수 · 2026년 9월</p>
          <p className="mt-[10px] text-[21px] leading-relaxed text-[#1b3a55]">
            특별공급과 일반공급의 접수 시각이 다릅니다.
            <br />
            <strong>정확한 일정은 모집공고 붙임 「공급일정표」</strong>를 확인하세요.
          </p>
        </div>

        <div className="mt-auto border-t border-white/25 pt-[30px]">
          <p className="text-[24px] font-semibold">
            새길주거공사 홈페이지 → 임대주택 → 공고·공지사항
          </p>
          <p className="mt-[8px] font-mono text-[25px] tracking-tight text-[#9ec8f2]">
            antelope.up.railway.app/demo/youth-housing
          </p>
          <p className="mt-[18px] text-[18px] text-white/55">
            공고번호 2026-민간임대-0087 · 청약센터 054-000-0000 (평일 09:00~18:00) · 대리
            청약 불가 · 본 이미지는 검증용 가상 공고입니다
          </p>
        </div>
      </div>
    </div>
  );
}
