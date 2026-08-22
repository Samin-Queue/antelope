import type { DemoFile } from "./types";

/**
 * JUNCTION KOREA 2026 첨부.
 *
 * 랜딩은 영문이고 마감은 AoE(Anywhere on Earth) 로 적혀 있다. 한국 시각으로
 * 언제인지는 **Judging_Schedule.xlsx 를 열어야** 나온다 — 시간대를 잘못 읽으면
 * 하루를 잃는 함정을 일부러 남긴 것이다.
 */
export const junctionFiles: DemoFile[] = [
  {
    name: "Participant_Handbook.pdf",
    title: "Participant Handbook 2026",
    format: "pdf",
    size: "1.8 MB",
    note: "Eligibility, visa policy, and what to bring",
    markdown: `# JUNCTION KOREA 2026 — Participant Handbook

Version 1.2 · Published 2026-08-20 · Organizing Committee

## 1. Event at a glance

| Item | Detail |
| --- | --- |
| Dates | 2026-11-13 (Fri) 18:00 KST — 2026-11-15 (Sun) 15:00 KST |
| Venue | POSCO International Center, Pohang, Republic of Korea |
| Format | On-site only. No remote participation. |
| Capacity | 480 participants (approx. 110 teams) |
| Languages | English is the working language. Korean support available on site. |
| Participation fee | Free. Meals and 24h venue access included. |

## 2. Who can apply

- Anyone aged 18 or older on the event start date.
- Students, professionals, and independent developers are all welcome.
- No prior hackathon experience is required.
- Employees of a Partner company may participate but are **not eligible for that partner's track prize**.

## 3. Team rules

| Rule | Detail |
| --- | --- |
| Team size | 3 to 5 people. Teams of 1 or 2 will be merged at the Team Building session. |
| Applying | Apply individually, or as a team with one member acting as Team Lead. |
| Team changes | Allowed until 2026-10-25. After that the roster is frozen. |
| Track | One track per team. The track is chosen at check-in, not at application. |

> A team application still requires **every member to hold an individual account**. The Team Lead submits the roster; each member receives a confirmation email and must accept within 72 hours.

## 4. Travel and visa

- The Organizing Committee does **not** issue visa invitation letters and does **not** sponsor visas.
- Domestic travel reimbursement: up to KRW 60,000 per participant travelling from outside Gyeongsangbuk-do, receipt required.
- International participants are responsible for their own travel and accommodation.
- Accommodation is not provided. The venue is open 24 hours and has a designated rest area.

## 5. What to bring

| Required | Optional |
| --- | --- |
| Laptop and charger | Extension cord / power strip |
| Government-issued photo ID | Monitor (max 24") |
| Multi-plug adapter (Type C/F, 220V) | Sleeping bag |
| Student or employment proof if you claimed a discount | Hardware for the Hardware track |

## 6. Judging

Submissions are evaluated in two rounds. Round 1 is a booth demo judged by track partners. Round 2 is a stage pitch in front of the full jury.

| Criterion | Weight |
| --- | --- |
| Technical execution | 30% |
| Problem fit and impact | 25% |
| Originality | 20% |
| Demo quality | 15% |
| Use of partner technology | 10% |

Exact times for each judging round are in **Judging_Schedule.xlsx**. Times printed on the website are in AoE; the spreadsheet gives the KST equivalent.

## 7. Code of conduct

Harassment of any kind ends participation immediately and without refund of travel support. Report incidents to any staff member wearing a purple badge, or to conduct@junctionkorea.example.

## 8. Intellectual property

Participants retain full ownership of everything they build. By submitting, you grant the Organizing Committee a non-exclusive right to show your project publicly for promotional purposes.

## 9. Contact

| Topic | Address |
| --- | --- |
| Applications | apply@junctionkorea.example |
| Partnerships | partners@junctionkorea.example |
| On-site support | help@junctionkorea.example |
`,
  },
  {
    name: "Judging_Schedule.xlsx",
    title: "Judging & Deadline Schedule",
    format: "xlsx",
    size: "42 KB",
    note: "AoE deadlines converted to KST — the real cut-off is here",
    markdown: `# JUNCTION KOREA 2026 — Schedule (AoE / KST)

Prepared by the Organizing Committee · Last updated 2026-08-21

## 1. Application deadlines

| Milestone | Deadline (AoE) | Deadline (KST) | Note |
| --- | --- | --- | --- |
| Early application closes | 2026-09-13 23:59 | 2026-09-14 20:59 | Reduced review queue |
| Regular application closes | 2026-09-30 23:59 | 2026-10-01 20:59 | Final cut-off |
| Team roster freeze | 2026-10-25 23:59 | 2026-10-26 20:59 | No member changes after |
| Confirmation of attendance | 2026-11-02 23:59 | 2026-11-03 20:59 | Non-response releases the seat |

> AoE (Anywhere on Earth) is UTC-12. A deadline of 2026-09-30 23:59 AoE is 2026-10-01 20:59 in Korea Standard Time. Applications submitted after the KST time above are rejected automatically.

## 2. Review timeline

| Stage | Date | Owner |
| --- | --- | --- |
| Application screening | 2026-10-02 ~ 2026-10-09 | Review committee |
| Results announced (first batch) | 2026-10-12 | Email |
| Waitlist movement | 2026-10-13 ~ 2026-11-01 | Rolling |
| Final participant list | 2026-11-04 | Email + website |

## 3. Event weekend

| Time (KST) | Day | Session |
| --- | --- | --- |
| 2026-11-13 16:00 | Fri | Check-in opens |
| 2026-11-13 18:00 | Fri | Opening ceremony |
| 2026-11-13 19:30 | Fri | Team building for solo applicants |
| 2026-11-13 20:00 | Fri | Hacking begins |
| 2026-11-14 10:00 | Sat | Partner workshops (parallel, 4 tracks) |
| 2026-11-14 21:00 | Sat | Mid-point mentor review |
| 2026-11-15 08:00 | Sun | Hacking ends. Submission closes. |
| 2026-11-15 09:00 | Sun | Round 1 — booth demo |
| 2026-11-15 12:30 | Sun | Round 2 — stage pitch (finalists) |
| 2026-11-15 14:30 | Sun | Awards |

## 4. Prizes

| Award | Amount (KRW) | Count |
| --- | --- | --- |
| Grand Prize | 10,000,000 | 1 |
| Track Winner | 4,000,000 | 4 |
| Partner Choice | 2,000,000 | 4 |
| Best Rookie (first hackathon) | 1,000,000 | 1 |

## 5. Submission requirements

| Item | Requirement |
| --- | --- |
| Repository | Public Git repository, commits from event weekend only |
| Demo video | Max 3 minutes, MP4 or a public link |
| Slide deck | Max 8 slides, PDF |
| Devpost-style writeup | 300 words minimum |
`,
  },
  {
    name: "Team_Roster_Template.xlsx",
    title: "Team Roster Template",
    format: "xlsx",
    size: "18 KB",
    note: "Team Lead must upload this filled in",
    markdown: `# Team Roster — JUNCTION KOREA 2026

Fill one row per member, including the Team Lead. Upload the completed file in Step 4 of the application.

## Team

| Field | Value |
| --- | --- |
| Team name |  |
| Preferred track |  |
| Team lead email |  |
| Looking for more members? |  |

## Members

| # | Full name | Email | Role | GitHub | T-shirt | Dietary |
| --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |

## Notes

| Rule | Detail |
| --- | --- |
| Minimum members | 3 |
| Maximum members | 5 |
| File name | TeamRoster_<TeamName>.xlsx |
| Accepted roles | Developer, Designer, Product, Data, Hardware |
`,
  },
  {
    name: "참가확약서_국내참가자.hwp",
    title: "참가확약서 (국내 참가자용 지정서식)",
    format: "hwp",
    size: "96 KB",
    note: "국내 참가자는 이 HWP 서식만 인정된다",
    markdown: `# JUNCTION KOREA 2026 참가확약서

본 서식은 대한민국 거주 참가자에게만 적용된다. 국외 거주 참가자는 온라인 동의로 갈음한다.

## 1. 참가자 정보

| 항목 | 값 |
| --- | --- |
| 성명 |  |
| 생년월일 |  |
| 휴대전화 |  |
| 이메일 |  |
| 소속 (학교 또는 회사) |  |
| 팀명 |  |

## 2. 여비 지원 신청

| 항목 | 값 |
| --- | --- |
| 출발 지역 |  |
| 교통수단 |  |
| 예상 왕복 교통비 |  |
| 입금 계좌 (은행/계좌번호/예금주) |  |

## 3. 확약 사항

| 항목 | 값 |
| --- | --- |
| 행사 전 기간 현장 참여에 동의 |  |
| 행동강령 준수에 동의 |  |
| 초상권 활용(홍보 목적)에 동의 |  |
| 개인정보 수집·이용에 동의 |  |

## 4. 서명

| 항목 | 값 |
| --- | --- |
| 작성일 |  |
| 참가자 서명 |  |
`,
  },
];
