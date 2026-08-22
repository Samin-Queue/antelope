import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JUNCTION KOREA 2026 Promo",
  robots: { index: false, follow: false },
};

/**
 * 홍보 이미지 원본. `/demo/junction-apply/poster.png` 가 이 화면을 찍는다.
 *
 * 마감이 **AoE 로만** 적혀 있다. 이미지 한 장만 보고 「9월 30일」로 읽으면 틀린다 —
 * 한국 시각은 사이트에 들어가 엑셀을 열어야 나온다.
 */
export default function JunctionPoster() {
  return (
    <div className="relative h-[1350px] w-[1080px] overflow-hidden bg-[#0b0b12] text-white">
      <div
        className="absolute -top-[220px] -right-[180px] size-[720px] rounded-full opacity-40 blur-[120px]"
        style={{ background: "#7c4dff" }}
      />
      <div
        className="absolute -bottom-[260px] -left-[200px] size-[640px] rounded-full opacity-30 blur-[130px]"
        style={{ background: "#22d3ee" }}
      />

      <div className="relative flex h-full flex-col px-[76px] py-[84px]">
        <div className="flex items-center gap-3">
          <span className="text-[30px] font-black tracking-[0.22em]">JUNCTION</span>
          <span className="rounded bg-[#7c4dff] px-[12px] py-[5px] text-[19px] font-bold">
            KOREA 2026
          </span>
        </div>

        <p className="mt-[86px] text-[24px] font-semibold tracking-[0.32em] text-[#c4b5fd] uppercase">
          48 hours · Pohang · Nov 13–15
        </p>
        <h1 className="mt-[24px] text-[92px] leading-[1.03] font-black tracking-tight">
          Build something
          <br />
          that shouldn&apos;t
          <br />
          exist yet.
        </h1>

        <div className="mt-[54px] grid grid-cols-4 gap-[14px]">
          {[
            ["480", "participants"],
            ["110", "teams"],
            ["4", "tracks"],
            ["₩26M", "prizes"],
          ].map(([n, label]) => (
            <div
              key={label}
              className="rounded-lg border border-white/15 bg-white/[0.06] px-[18px] py-[24px]"
            >
              <p className="text-[40px] leading-none font-black">{n}</p>
              <p className="mt-[10px] text-[17px] tracking-wide text-white/55 uppercase">
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-[46px] grid grid-cols-2 gap-[14px] text-[21px]">
          {[
            "AI & Document Intelligence — Upstage",
            "Fintech & Open Banking — Hanmoa Bank",
            "Sustainability — POSCO Future M",
            "Open Track — anything goes",
          ].map((t) => (
            <p
              key={t}
              className="rounded bg-white/[0.06] px-[18px] py-[16px] text-white/80"
            >
              {t}
            </p>
          ))}
        </div>

        <div className="mt-[46px] rounded-lg border-2 border-[#7c4dff] px-[32px] py-[28px]">
          <p className="text-[30px] font-black">
            Applications close 30 Sep 2026, 23:59{" "}
            <span className="text-[#c4b5fd]">AoE</span>
          </p>
          <p className="mt-[10px] text-[20px] text-white/60">
            AoE is UTC−12. The KST cut-off is later — check Judging_Schedule.xlsx on the
            site before you assume a date.
          </p>
        </div>

        <div className="mt-auto border-t border-white/20 pt-[28px]">
          <p className="font-mono text-[27px] tracking-tight text-[#c4b5fd]">
            antelope.up.railway.app/demo/junction-apply
          </p>
          <p className="mt-[14px] text-[18px] text-white/45">
            Teams of 3–5 · On-site only · No visa sponsorship ·
            apply@junctionkorea.example · Fictional event page built to test a document
            agent
          </p>
        </div>
      </div>
    </div>
  );
}
