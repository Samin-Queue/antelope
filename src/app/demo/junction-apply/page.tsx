import Link from "next/link";
import { Download, FileSpreadsheet, FileText, ImageIcon } from "lucide-react";

import { fileHref, filesFor } from "../_lib/attachments";
import { DarkTable, JunctionFooter, JunctionHeader, Section } from "./_lib/shell";

const files = filesFor("junction-apply");

/**
 * 이벤트 랜딩.
 *
 * 마감이 **AoE(Anywhere on Earth)** 로만 적혀 있다. 한국 시각으로 언제인지는
 * Judging_Schedule.xlsx 를 열어야 나온다 — 시간대를 그냥 읽으면 하루를 잃는다.
 */
export default function JunctionLanding() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#0b0b12]">
      <JunctionHeader active="Overview" />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-10">
        {/* Hero */}
        <div className="border-b border-white/10 py-16">
          <p className="text-[11px] font-semibold tracking-[0.35em] text-[#a78bfa] uppercase">
            48 hours · Pohang · Nov 13–15, 2026
          </p>
          <h1 className="mt-4 text-[46px] leading-[1.05] font-black tracking-tight text-white sm:text-[62px]">
            Build something
            <br />
            that shouldn&apos;t exist yet.
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/65">
            JUNCTION KOREA 2026 brings 480 developers, designers and makers to Pohang for
            48 hours. Four tracks, twelve partners, one weekend. Applications are open —
            individually or as a team of three to five.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <p className="w-full text-[14px] font-semibold break-all text-[#c4b5fd]">
              {
                "Application URL: https://antelope.up.railway.app/demo/junction-apply/apply"
              }
            </p>
            <Link
              href="/demo/junction-apply/tracks"
              className="rounded border border-white/20 px-6 py-3 text-[14px] font-semibold text-white/80 hover:border-white/50"
            >
              See the tracks
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded border border-white/10 bg-white/10 sm:grid-cols-4">
            {[
              ["480", "participants"],
              ["110", "teams"],
              ["4", "tracks"],
              ["₩26M", "in prizes"],
            ].map(([n, label]) => (
              <div key={label} className="bg-[#0b0b12] px-5 py-5">
                <p className="text-[28px] font-black text-white">{n}</p>
                <p className="mt-0.5 text-[12px] tracking-wide text-white/45 uppercase">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Deadline */}
        <Section eyebrow="Deadlines" title="Applications close 30 Sep 2026, 23:59 AoE">
          <div className="rounded border border-[#7c4dff]/40 bg-[#7c4dff]/10 px-5 py-4 text-[14px] leading-relaxed text-white/85">
            <p>
              All published deadlines use <strong>AoE (Anywhere on Earth, UTC−12)</strong>
              . If you are applying from Korea, the effective cut-off is later the
              following day in KST.
            </p>
            <p className="mt-2 text-white/60">
              The exact KST equivalents for every milestone are listed in{" "}
              <a
                href={fileHref("junction-apply", "Judging_Schedule.xlsx")}
                className="font-semibold text-[#c4b5fd] underline underline-offset-4"
              >
                Judging_Schedule.xlsx
              </a>
              . We do not repeat them on this page — the spreadsheet is the single source
              of truth and it is updated when the schedule moves.
            </p>
          </div>

          <div className="mt-5">
            <DarkTable
              head={["Milestone", "Deadline (AoE)", "Where to check KST"]}
              rows={[
                ["Early application", "13 Sep 2026 23:59", "Judging_Schedule.xlsx"],
                ["Regular application", "30 Sep 2026 23:59", "Judging_Schedule.xlsx"],
                ["Roster freeze", "25 Oct 2026 23:59", "Judging_Schedule.xlsx"],
                ["Confirm attendance", "02 Nov 2026 23:59", "Judging_Schedule.xlsx"],
              ]}
            />
          </div>
        </Section>

        {/* Tracks preview */}
        <Section eyebrow="Tracks" title="Pick your track at check-in, not now">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [
                "AI & Document Intelligence",
                "Upstage",
                "Turn unstructured documents into something a machine can act on.",
              ],
              [
                "Fintech & Open Banking",
                "Hanmoa Bank",
                "Payments, credit, fraud — build on a sandbox with real-shaped data.",
              ],
              [
                "Sustainability",
                "POSCO Future M",
                "Energy, materials, logistics. Measurable impact beats a pretty demo.",
              ],
              [
                "Open Track",
                "Organizing Committee",
                "Anything goes. Judged purely on execution and originality.",
              ],
            ].map(([name, partner, desc]) => (
              <div
                key={name}
                className="rounded border border-white/10 bg-white/[0.03] px-5 py-5"
              >
                <p className="text-[11px] font-semibold tracking-widest text-[#a78bfa] uppercase">
                  {partner}
                </p>
                <p className="mt-1.5 text-[17px] font-bold text-white">{name}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">{desc}</p>
              </div>
            ))}
          </div>
          <Link
            href="/demo/junction-apply/tracks"
            className="mt-5 inline-block text-[13px] font-semibold text-[#c4b5fd] underline underline-offset-4"
          >
            Full track briefs, prizes and judging criteria →
          </Link>
        </Section>

        {/* Eligibility */}
        <Section eyebrow="Before you apply" title="Three things that trip people up">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [
                "Teams are 3 to 5",
                "Apply solo and we will match you at the Team Building session. Teams of 1 or 2 are merged.",
              ],
              [
                "No visa support",
                "We do not issue invitation letters and do not sponsor visas. International applicants arrange their own travel.",
              ],
              [
                "On-site only",
                "There is no remote track. If you cannot be in Pohang for the full weekend, do not apply.",
              ],
            ].map(([title, body]) => (
              <div key={title} className="rounded border border-white/10 px-5 py-5">
                <p className="text-[15px] font-bold text-white">{title}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-white/50">
            Everything else is in the{" "}
            <Link
              href="/demo/junction-apply/faq"
              className="font-semibold text-[#c4b5fd] underline underline-offset-4"
            >
              FAQ
            </Link>{" "}
            and the Participant Handbook below.
          </p>
        </Section>

        {/* Downloads */}
        <Section eyebrow="Documents" title="Downloads">
          <ul className="grid gap-2">
            {files.map((f) => {
              const Icon = f.format === "xlsx" ? FileSpreadsheet : FileText;
              return (
                <li key={f.name}>
                  <a
                    href={fileHref("junction-apply", f.name)}
                    className="flex flex-wrap items-center gap-3 rounded border border-white/10 bg-white/[0.03] px-4 py-3.5 hover:border-white/30"
                  >
                    <Icon className="size-4 shrink-0 text-[#a78bfa]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-white">
                        {f.name}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-white/45">
                        {f.title}
                        {f.note ? ` · ${f.note}` : ""}
                      </span>
                    </span>
                    <span className="text-[11px] text-white/35 tabular-nums">
                      {f.size}
                    </span>
                    <Download className="size-3.5 shrink-0 text-white/45" />
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/demo/junction-apply/notice.pdf"
              download
              className="inline-flex items-center gap-1.5 rounded border border-white/20 px-3 py-2 text-[12px] font-semibold text-white/75 hover:border-white/50"
            >
              <Download className="size-3.5" />
              This page as PDF
            </a>
            <a
              href="/demo/junction-apply/poster.png"
              download
              className="inline-flex items-center gap-1.5 rounded border border-white/20 px-3 py-2 text-[12px] font-semibold text-white/75 hover:border-white/50"
            >
              <ImageIcon className="size-3.5" />
              Promo image (PNG)
            </a>
          </div>
        </Section>

        {/* Partners */}
        <Section eyebrow="Partners" title="Twelve partners, four of them judging">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-white/10 bg-white/10 sm:grid-cols-4">
            {[
              "Upstage",
              "Hanmoa Bank",
              "POSCO Future M",
              "Saegil Housing",
              "Daon Soft",
              "Nuri Ventures",
              "Onbit City",
              "KITQ",
              "Mirae Hope",
              "Hanbit Housing",
              "Open Innovation",
              "Easy University",
            ].map((p) => (
              <div
                key={p}
                className="bg-[#0b0b12] px-4 py-6 text-center text-[12px] font-semibold tracking-wide text-white/45"
              >
                {p}
              </div>
            ))}
          </div>
        </Section>

        <div className="mt-16 rounded border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
          <p className="text-[20px] font-bold text-white">Ready?</p>
          <p className="mt-1.5 text-[13px] text-white/55">
            The application takes about 15 minutes. You can save and come back.
          </p>
          <p className="mt-5 text-[14px] font-semibold break-all text-[#c4b5fd]">
            {"Application URL: https://antelope.up.railway.app/demo/junction-apply/apply"}
          </p>
        </div>
      </main>

      <JunctionFooter />
    </div>
  );
}
