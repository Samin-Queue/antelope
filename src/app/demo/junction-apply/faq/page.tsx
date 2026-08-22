import Link from "next/link";

import { JunctionFooter, JunctionHeader } from "../_lib/shell";
import { fileHref } from "../../_lib/attachments";

/**
 * FAQ.
 *
 * 랜딩에 없는 조건이 여기 있다 — 국내 참가자만 내는 HWP 확약서, 여비 상한,
 * 팀원 초대 수락 72시간, 대기자 이동. 랜딩만 읽으면 서류 하나를 통째로 놓친다.
 */
const ITEMS: { q: string; a: React.ReactNode; tag: string }[] = [
  {
    tag: "Eligibility",
    q: "Do I need to be a student?",
    a: (
      <p>
        No. Anyone 18 or older on 13 Nov 2026 can apply — students, professionals,
        independent developers. There is no separate student track.
      </p>
    ),
  },
  {
    tag: "Eligibility",
    q: "I work at one of the partner companies. Can I compete?",
    a: (
      <p>
        Yes, but your team is{" "}
        <strong>not eligible for that partner&apos;s track prize</strong>. You can still
        win the Grand Prize or another track.
      </p>
    ),
  },
  {
    tag: "Teams",
    q: "I do not have a team.",
    a: (
      <p>
        Apply as an individual. On Friday evening there is a Team Building session where
        solo applicants form teams. Teams of one or two that arrive already formed are
        merged at the same session.
      </p>
    ),
  },
  {
    tag: "Teams",
    q: "How does a team application work?",
    a: (
      <>
        <p>
          One member applies as Team Lead and uploads a filled{" "}
          <a
            href={fileHref("junction-apply", "Team_Roster_Template.xlsx")}
            className="font-semibold text-[#c4b5fd] underline underline-offset-4"
          >
            Team_Roster_Template.xlsx
          </a>
          . Every listed member then receives an invitation email.
        </p>
        <p>
          <strong>Each member must accept within 72 hours.</strong> Members who do not
          accept are dropped from the roster, and if that takes the team below three the
          whole application returns to the individual pool.
        </p>
      </>
    ),
  },
  {
    tag: "Teams",
    q: "Can we change members after applying?",
    a: (
      <p>
        Until the roster freeze. The exact freeze time in KST is in Judging_Schedule.xlsx.
        After that the roster is final and substitutions are not accepted at check-in.
      </p>
    ),
  },
  {
    tag: "Deadline",
    q: "What does AoE mean?",
    a: (
      <p>
        Anywhere on Earth, UTC−12. A deadline of 30 Sep 23:59 AoE is{" "}
        <strong>1 Oct 20:59 KST</strong>. Every AoE deadline and its KST equivalent is
        listed in Judging_Schedule.xlsx. Applications submitted after the KST time are
        rejected by the system, not by a reviewer.
      </p>
    ),
  },
  {
    tag: "Documents",
    q: "Is there anything to submit besides the online form?",
    a: (
      <>
        <p>
          Applicants resident in Korea must also submit the{" "}
          <a
            href={fileHref("junction-apply", "참가확약서_국내참가자.hwp")}
            className="font-semibold text-[#c4b5fd] underline underline-offset-4"
          >
            참가확약서 (HWP)
          </a>
          . It is a Korean government-style form and only the HWP version is accepted — a
          PDF export is rejected.
        </p>
        <p>
          Applicants resident outside Korea consent online instead and submit nothing
          extra.
        </p>
      </>
    ),
  },
  {
    tag: "Travel",
    q: "Do you cover travel?",
    a: (
      <p>
        Domestic travel only: up to <strong>KRW 60,000</strong> per participant coming
        from outside Gyeongsangbuk-do, reimbursed against receipts after the event. The
        bank account for reimbursement goes on the 참가확약서, not the online form.
      </p>
    ),
  },
  {
    tag: "Travel",
    q: "Can you sponsor my visa?",
    a: (
      <p>
        No. We do not issue invitation letters and do not sponsor visas. This is stated in
        the Participant Handbook, section 4.
      </p>
    ),
  },
  {
    tag: "Travel",
    q: "Is accommodation provided?",
    a: (
      <p>
        No. The venue is open for all 48 hours and has a rest area, but there are no beds.
        Bring a sleeping bag if you plan to sleep on site.
      </p>
    ),
  },
  {
    tag: "Review",
    q: "When do I hear back?",
    a: (
      <p>
        Screening runs for a week after the regular deadline, and the first batch of
        results goes out by email. Waitlist movement continues until early November. Exact
        dates are in Judging_Schedule.xlsx.
      </p>
    ),
  },
  {
    tag: "On site",
    q: "What do I need to bring?",
    a: (
      <p>
        Laptop, charger, a 220V Type C/F adapter, and government-issued photo ID. Monitors
        up to 24 inches are allowed. Anything that draws venue power beyond a laptop must
        be declared in the application if you are on the Sustainability track.
      </p>
    ),
  },
];

export default function JunctionFaq() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#0b0b12]">
      <JunctionHeader active="FAQ" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-10">
        <div className="border-b border-white/10 py-12">
          <h1 className="text-[38px] leading-tight font-black tracking-tight text-white">
            FAQ
          </h1>
          <p className="mt-3 text-[14px] text-white/60">
            자주 묻는 질문 · If the handbook and this page disagree, the handbook wins.
          </p>
        </div>

        <div className="divide-y divide-white/10">
          {ITEMS.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 py-4 text-[14px] font-semibold text-white">
                <span className="flex-1">
                  <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white/50 uppercase">
                    {item.tag}
                  </span>
                  {item.q}
                </span>
                <span className="text-white/40 group-open:rotate-180">⌄</span>
              </summary>
              <div className="space-y-2 pb-5 text-[13px] leading-[1.85] text-white/65">
                {item.a}
              </div>
            </details>
          ))}
        </div>

        <div className="mt-12 rounded border border-white/10 bg-white/[0.03] px-5 py-5 text-[13px] text-white/60">
          Still stuck? apply@junctionkorea.example ·{" "}
          <Link
            href="/demo/junction-apply/apply"
            className="font-semibold text-[#c4b5fd] underline underline-offset-4"
          >
            Go to the application
          </Link>
        </div>
      </main>
      <JunctionFooter />
    </div>
  );
}
