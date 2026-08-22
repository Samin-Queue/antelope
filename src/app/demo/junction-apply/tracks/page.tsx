import Link from "next/link";

import { DarkTable, JunctionFooter, JunctionHeader, Section } from "../_lib/shell";
import { fileHref } from "../../_lib/attachments";

/**
 * 트랙 브리프.
 *
 * 트랙마다 **지원 단계에서 물어보는 것이 다르다.** AI 트랙은 데이터셋 접근 신청,
 * Fintech 은 샌드박스 키 발급 동의, Sustainability 는 하드웨어 반입 신고,
 * Open 은 없음. 신청 폼의 조건부 분기가 여기서 나온다.
 */
const TRACKS = [
  {
    id: "ai",
    partner: "Upstage",
    name: "AI & Document Intelligence",
    brief:
      "Documents are where most enterprise data still hides — contracts, notices, application forms, scanned PDFs nobody has indexed. Build something that reads them and then acts.",
    prize: "₩4,000,000",
    api: "Document Parse, Information Extract, Solar Pro 4",
    extra: "Dataset access request (state the corpus you intend to use)",
    criteria: [
      ["Extraction accuracy on unseen documents", "35%"],
      ["What the product does with the extraction", "30%"],
      ["Handling of low-confidence output", "20%"],
      ["Demo", "15%"],
    ],
  },
  {
    id: "fintech",
    partner: "Hanmoa Bank",
    name: "Fintech & Open Banking",
    brief:
      "A sandbox with realistically shaped account, card and transfer data. Payments, credit scoring, fraud detection, or something we have not thought of.",
    prize: "₩4,000,000",
    api: "Open Banking sandbox, KYC mock, transaction stream",
    extra: "Sandbox key issuance consent (name + email shared with the partner)",
    criteria: [
      ["Correctness under adversarial input", "30%"],
      ["Regulatory realism", "25%"],
      ["Product thinking", "25%"],
      ["Demo", "20%"],
    ],
  },
  {
    id: "sustainability",
    partner: "POSCO Future M",
    name: "Sustainability",
    brief:
      "Energy, materials and logistics. We care about a number you can defend — tonnes, kilowatt-hours, kilometres — not a mood board.",
    prize: "₩4,000,000",
    api: "Emissions dataset, plant telemetry replay, logistics graph",
    extra: "Hardware declaration (anything you plug into venue power)",
    criteria: [
      ["Measurable impact", "35%"],
      ["Technical execution", "30%"],
      ["Feasibility at scale", "20%"],
      ["Demo", "15%"],
    ],
  },
  {
    id: "open",
    partner: "Organizing Committee",
    name: "Open Track",
    brief:
      "No partner, no dataset, no constraints. Judged purely on what you built and how surprising it is.",
    prize: "₩4,000,000",
    api: "None",
    extra: "None",
    criteria: [
      ["Originality", "40%"],
      ["Technical execution", "35%"],
      ["Demo", "25%"],
    ],
  },
];

export default function JunctionTracks() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#0b0b12]">
      <JunctionHeader active="Tracks" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-10">
        <div className="border-b border-white/10 py-12">
          <h1 className="text-[38px] leading-tight font-black tracking-tight text-white">
            Four tracks
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/60">
            You choose your track at check-in on Friday, not in the application. What you
            pick in the application form only decides which extra questions we ask now —
            dataset access, sandbox keys, hardware you plan to bring.
          </p>
        </div>

        {TRACKS.map((t) => (
          <Section key={t.id} eyebrow={t.partner} title={t.name}>
            <p className="max-w-2xl text-[14px] leading-relaxed text-white/65">
              {t.brief}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded border border-white/10 px-4 py-4">
                <p className="text-[11px] tracking-widest text-white/40 uppercase">
                  Track prize
                </p>
                <p className="mt-1 text-[20px] font-black text-white">{t.prize}</p>
              </div>
              <div className="rounded border border-white/10 px-4 py-4">
                <p className="text-[11px] tracking-widest text-white/40 uppercase">
                  Provided
                </p>
                <p className="mt-1 text-[13px] text-white/70">{t.api}</p>
              </div>
              <div className="rounded border border-white/10 px-4 py-4">
                <p className="text-[11px] tracking-widest text-white/40 uppercase">
                  Asked in the form
                </p>
                <p className="mt-1 text-[13px] text-white/70">{t.extra}</p>
              </div>
            </div>
            <div className="mt-4">
              <DarkTable
                head={["Judging criterion", "Weight"]}
                rows={t.criteria.map((c) => [c[0], c[1]])}
              />
            </div>
          </Section>
        ))}

        <Section eyebrow="Prizes" title="Awards across all tracks">
          <DarkTable
            head={["Award", "Amount (KRW)", "Count", "Eligibility"]}
            rows={[
              ["Grand Prize", "10,000,000", 1, "Any track"],
              ["Track Winner", "4,000,000", 4, "One per track"],
              ["Partner Choice", "2,000,000", 4, "Chosen by the partner, not the jury"],
              ["Best Rookie", "1,000,000", 1, "All members at their first hackathon"],
            ]}
          />
          <p className="mt-3 text-[13px] text-white/50">
            Round-by-round timing is in{" "}
            <a
              href={fileHref("junction-apply", "Judging_Schedule.xlsx")}
              className="font-semibold text-[#c4b5fd] underline underline-offset-4"
            >
              Judging_Schedule.xlsx
            </a>
            . Employees of a partner may compete but cannot win that partner&apos;s track
            prize.
          </p>
        </Section>

        <div className="mt-14">
          <Link
            href="/demo/junction-apply/apply"
            className="inline-block rounded bg-[#7c4dff] px-6 py-3 text-[14px] font-bold text-white hover:bg-[#6b3df0]"
          >
            Apply →
          </Link>
        </div>
      </main>
      <JunctionFooter />
    </div>
  );
}
