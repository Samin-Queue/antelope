"use client";

import Link from "next/link";
import * as React from "react";

import { JunctionFooter, JunctionHeader } from "../_lib/shell";
import {
  Callout,
  Cell,
  cellInputCls,
  Field,
  Fieldset,
  FileDrop,
  inputCls,
  receiptNo,
  RepeatRows,
  Steps,
  Submitted,
  type PickedFile,
} from "../../_lib/fields";
import { fileHref } from "../../_lib/file-href";

/**
 * 참가 신청 — 4단계.
 *
 * 껍데기는 검은데 폼은 흰 바닥이다. 실제 행사 사이트가 그렇고, 무엇보다 폼
 * 부품(`_lib/fields`)을 그대로 쓸 수 있다 — 어두운 사본을 하나 더 만들면 두 벌이
 * 갈라진다.
 *
 * 마찰 넷: 이메일 인증, 에세이 글자수 하한·상한, 트랙별 추가 질문, 팀 지원 시
 * 로스터 XLSX 파일명 규칙. 한국 거주자에게만 HWP 확약서를 더 받는다 — 영문
 * 사이트에서 한글 서식이 튀어나오는 그 지점이 실제로 사람이 넘어지는 곳이다.
 */
const STEPS = ["Account", "About you", "Experience", "Team & track"];

const TRACKS = [
  "AI & Document Intelligence (Upstage)",
  "Fintech & Open Banking (Hanmoa Bank)",
  "Sustainability (POSCO Future M)",
  "Open Track",
];

const SKILLS = [
  "Frontend",
  "Backend",
  "Mobile",
  "ML / Data",
  "Design",
  "Product",
  "Hardware",
  "DevOps",
];

const ESSAY_MIN = 100;
const ESSAY_MAX = 500;

type Project = { name: string; role: string; url: string; year: string };
type Member = { name: string; email: string; role: string; github: string };

export default function JunctionApply() {
  const [step, setStep] = React.useState(0);
  const [receipt, setReceipt] = React.useState<string | null>(null);

  /* 1 */
  const [email, setEmail] = React.useState("");
  const [sentCode, setSentCode] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [verified, setVerified] = React.useState(false);
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");

  /* 2 */
  const [fullName, setFullName] = React.useState("");
  const [birth, setBirth] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [city, setCity] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [shirt, setShirt] = React.useState("");
  const [diet, setDiet] = React.useState("None");
  const [firstTime, setFirstTime] = React.useState("");

  /* 3 */
  const [github, setGithub] = React.useState("");
  const [years, setYears] = React.useState("");
  const [skills, setSkills] = React.useState<string[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [essay1, setEssay1] = React.useState("");
  const [essay2, setEssay2] = React.useState("");

  /* 4 */
  const [mode, setMode] = React.useState("");
  const [teamName, setTeamName] = React.useState("");
  const [members, setMembers] = React.useState<Member[]>([]);
  const [roster, setRoster] = React.useState<PickedFile[]>([]);
  const [track, setTrack] = React.useState("");
  const [corpus, setCorpus] = React.useState("");
  const [sandbox, setSandbox] = React.useState(false);
  const [hardware, setHardware] = React.useState("");
  const [pledge, setPledge] = React.useState<PickedFile[]>([]);
  const [consents, setConsents] = React.useState<string[]>([]);

  const koreaResident = country === "Republic of Korea";
  const githubOk = github === "" || /^https:\/\/github\.com\/[\w.-]+\/?$/.test(github);
  const essay1Ok = essay1.length >= ESSAY_MIN && essay1.length <= ESSAY_MAX;
  const essay2Ok = essay2.length >= ESSAY_MIN && essay2.length <= ESSAY_MAX;
  const teamSizeOk = members.length >= 2 && members.length <= 4; // 팀장 제외 인원

  const trackExtraOk =
    track === TRACKS[0]
      ? corpus.trim().length > 0
      : track === TRACKS[1]
        ? sandbox
        : track === TRACKS[2]
          ? hardware.trim().length > 0
          : Boolean(track);

  const canNext = [
    Boolean(email && verified && password.length >= 8),
    Boolean(fullName && birth && country && city && shirt && firstTime),
    Boolean(years && skills.length > 0 && githubOk && essay1Ok && essay2Ok),
    Boolean(
      mode &&
      (mode === "individual" || (teamName && teamSizeOk && roster.length > 0)) &&
      trackExtraOk &&
      (!koreaResident || pledge.length > 0) &&
      consents.length === 3,
    ),
  ][step];

  function sendCode() {
    setSentCode("904517");
    setVerified(false);
    setCode("");
    setCodeError(null);
  }

  function verify() {
    if (code === sentCode) {
      setVerified(true);
      setCodeError(null);
    } else {
      setCodeError("That code does not match. Check the six digits and try again.");
    }
  }

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canNext) return;
    setReceipt(receiptNo("JK26"));
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#0b0b12]">
      <JunctionHeader />
      <div className="border-b border-white/10">
        <div className="mx-auto w-full max-w-3xl px-5 py-10">
          <p className="text-[11px] font-semibold tracking-[0.3em] text-[#a78bfa] uppercase">
            Application · 2026
          </p>
          <h1 className="mt-2 text-[32px] leading-tight font-black tracking-tight text-white">
            Participant Application
          </h1>
          <p className="mt-2 text-[13px] text-white/55">
            Regular applications close 30 Sep 2026 23:59 AoE. The KST equivalent is in{" "}
            <a
              href={fileHref("junction-apply", "Judging_Schedule.xlsx")}
              className="font-semibold text-[#c4b5fd] underline underline-offset-4"
            >
              Judging_Schedule.xlsx
            </a>
            .
          </p>
        </div>
      </div>

      <main className="flex-1 bg-white">
        <div className="mx-auto w-full max-w-3xl px-5 py-10">
          {receipt ? (
            <Submitted
              accent="bg-[#7c4dff]"
              receipt={receipt}
              summary={[
                { label: "Applicant", value: fullName },
                { label: "Email", value: email },
                {
                  label: "Type",
                  value: mode === "team" ? `Team · ${teamName}` : "Individual",
                },
                { label: "Track", value: track },
                { label: "Country", value: country },
              ]}
              onReset={() => {
                setReceipt(null);
                setStep(0);
              }}
              footer={
                <div className="mx-auto mt-6 max-w-md rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-[12px] leading-relaxed text-neutral-600">
                  {mode === "team"
                    ? "Invitation emails have been sent to every member on the roster. Each member must accept within 72 hours or they are dropped from the team."
                    : "You will be matched with a team at the Team Building session on Friday evening."}{" "}
                  Screening results go out by email — see the schedule spreadsheet for
                  dates.
                </div>
              }
            />
          ) : (
            <form onSubmit={submit}>
              <Steps steps={STEPS} current={step} accent="bg-[#7c4dff]" />

              {step === 0 && (
                <Fieldset
                  legend="1. Account"
                  desc="We send every notification to this address. Use one you will still read in November."
                >
                  <Field label="Email" htmlFor="email" required>
                    <div className="flex gap-2">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setVerified(false);
                          setSentCode(null);
                        }}
                        className={inputCls}
                        placeholder="you@example.com"
                      />
                      <button
                        type="button"
                        onClick={sendCode}
                        disabled={!email.includes("@")}
                        className="shrink-0 rounded border border-neutral-300 px-3 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                      >
                        Send code
                      </button>
                    </div>
                  </Field>

                  {sentCode && (
                    <Field label="Verification code" htmlFor="code" required>
                      <div className="flex gap-2">
                        <input
                          id="code"
                          name="code"
                          inputMode="numeric"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          className={inputCls}
                          placeholder="6 digits"
                          disabled={verified}
                        />
                        <button
                          type="button"
                          onClick={verify}
                          disabled={verified || code.length !== 6}
                          className="shrink-0 rounded border border-neutral-300 px-3 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                        >
                          {verified ? "Verified" : "Verify"}
                        </button>
                      </div>
                      {!verified && (
                        <Callout>
                          Demo environment — no email is actually sent. Your code is{" "}
                          <strong className="font-mono">{sentCode}</strong>.
                        </Callout>
                      )}
                      {codeError && (
                        <p className="text-xs font-medium text-red-600">{codeError}</p>
                      )}
                    </Field>
                  )}

                  <Field
                    label="Password"
                    htmlFor="password"
                    required
                    hint="At least 8 characters. You will use it to edit your application before the deadline."
                  >
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </Fieldset>
              )}

              {step === 1 && (
                <Fieldset
                  legend="2. About you"
                  desc="This is what goes on your badge and into the catering count."
                >
                  <Field label="Full name (as on your ID)" htmlFor="fullName" required>
                    <input
                      id="fullName"
                      name="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={inputCls}
                    />
                  </Field>

                  <Field
                    label="Date of birth"
                    htmlFor="birth"
                    required
                    hint="You must be 18 or older on 13 Nov 2026."
                  >
                    <input
                      id="birth"
                      name="birth"
                      type="date"
                      value={birth}
                      onChange={(e) => setBirth(e.target.value)}
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Country of residence" htmlFor="country" required>
                    <select
                      id="country"
                      name="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select…</option>
                      {[
                        "Republic of Korea",
                        "Japan",
                        "Singapore",
                        "Finland",
                        "Germany",
                        "United States",
                        "Other",
                      ].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="City" htmlFor="city" required>
                    <input
                      id="city"
                      name="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={inputCls}
                    />
                  </Field>

                  <Field
                    label="Phone"
                    htmlFor="phone"
                    hint="Optional, used only for on-site emergencies."
                  >
                    <input
                      id="phone"
                      name="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputCls}
                    />
                  </Field>

                  <Field label="T-shirt size" htmlFor="shirt" required>
                    <select
                      id="shirt"
                      name="shirt"
                      value={shirt}
                      onChange={(e) => setShirt(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select…</option>
                      {["XS", "S", "M", "L", "XL", "XXL"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Dietary requirement" htmlFor="diet">
                    <select
                      id="diet"
                      name="diet"
                      value={diet}
                      onChange={(e) => setDiet(e.target.value)}
                      className={inputCls}
                    >
                      {["None", "Vegetarian", "Vegan", "Halal", "No pork", "Allergy"].map(
                        (d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>

                  <Field
                    label="Is this your first hackathon?"
                    htmlFor="firstTime"
                    required
                  >
                    <select
                      id="firstTime"
                      name="firstTime"
                      value={firstTime}
                      onChange={(e) => setFirstTime(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select…</option>
                      <option value="yes">Yes — eligible for Best Rookie</option>
                      <option value="no">No</option>
                    </select>
                  </Field>
                </Fieldset>
              )}

              {step === 2 && (
                <Fieldset
                  legend="3. Experience"
                  desc="We read every essay. Two paragraphs of something true beat a page of adjectives."
                >
                  <Field
                    label="GitHub profile"
                    htmlFor="github"
                    hint="Full URL, e.g. https://github.com/yourname"
                  >
                    <input
                      id="github"
                      name="github"
                      value={github}
                      onChange={(e) => setGithub(e.target.value)}
                      className={inputCls}
                      placeholder="https://github.com/yourname"
                    />
                    {!githubOk && (
                      <p className="text-xs font-medium text-red-600">
                        Must be a full https://github.com/… profile URL.
                      </p>
                    )}
                  </Field>

                  <Field label="Years of building things" htmlFor="years" required>
                    <select
                      id="years"
                      name="years"
                      value={years}
                      onChange={(e) => setYears(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select…</option>
                      {["< 1", "1–2", "3–5", "6–9", "10+"].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Skills"
                    required
                    hint="Pick everything you would take on."
                  >
                    <div className="flex flex-wrap gap-2">
                      {SKILLS.map((s) => (
                        <label
                          key={s}
                          className={`cursor-pointer rounded border px-3 py-1.5 text-[13px] ${
                            skills.includes(s)
                              ? "border-[#7c4dff] bg-[#f3f0ff] font-medium text-[#4c1fd7]"
                              : "border-neutral-300 text-neutral-600"
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="skills"
                            value={s}
                            checked={skills.includes(s)}
                            onChange={() => toggle(skills, setSkills, s)}
                            className="sr-only"
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  </Field>

                  <Field
                    label="Projects you want us to look at"
                    hint="Optional. Up to five."
                  >
                    <RepeatRows<Project>
                      rows={projects}
                      setRows={setProjects}
                      blank={() => ({ name: "", role: "", url: "", year: "" })}
                      columns={["Project", "Your role", "URL", "Year"]}
                      max={5}
                      addLabel="Add a project"
                      render={(row, i, update) => (
                        <>
                          <Cell>
                            <input
                              name={`project-name-${i}`}
                              value={row.name}
                              onChange={(e) => update({ name: e.target.value })}
                              className={cellInputCls}
                            />
                          </Cell>
                          <Cell>
                            <input
                              name={`project-role-${i}`}
                              value={row.role}
                              onChange={(e) => update({ role: e.target.value })}
                              className={cellInputCls}
                            />
                          </Cell>
                          <Cell>
                            <input
                              name={`project-url-${i}`}
                              value={row.url}
                              onChange={(e) => update({ url: e.target.value })}
                              className={cellInputCls}
                              placeholder="https://"
                            />
                          </Cell>
                          <Cell>
                            <input
                              name={`project-year-${i}`}
                              value={row.year}
                              onChange={(e) => update({ year: e.target.value })}
                              className={cellInputCls}
                              placeholder="2025"
                            />
                          </Cell>
                        </>
                      )}
                    />
                  </Field>

                  <Essay
                    id="essay1"
                    label="What is the last thing you built that did not work, and what did you do about it?"
                    value={essay1}
                    onChange={setEssay1}
                  />
                  <Essay
                    id="essay2"
                    label="What do you want to walk out of the weekend with?"
                    value={essay2}
                    onChange={setEssay2}
                  />
                </Fieldset>
              )}

              {step === 3 && (
                <Fieldset
                  legend="4. Team and track"
                  desc="The track you pick here only decides which extra questions we ask. You confirm your real track at check-in."
                >
                  <Field label="How are you applying?" required>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        [
                          "individual",
                          "As an individual",
                          "We match you at Team Building on Friday.",
                        ],
                        [
                          "team",
                          "As a team",
                          "3 to 5 people including you. You are the Team Lead.",
                        ],
                      ].map(([value, title, desc]) => (
                        <label
                          key={value}
                          className={`flex cursor-pointer flex-col gap-1 rounded border px-4 py-3 text-[13px] ${
                            mode === value
                              ? "border-[#7c4dff] bg-[#f7f5ff]"
                              : "border-neutral-300"
                          }`}
                        >
                          <span className="flex items-center gap-2 font-semibold text-neutral-900">
                            <input
                              type="radio"
                              name="mode"
                              value={value}
                              checked={mode === value}
                              onChange={() => setMode(value)}
                            />
                            {title}
                          </span>
                          <span className="text-xs text-neutral-500">{desc}</span>
                        </label>
                      ))}
                    </div>
                  </Field>

                  {mode === "team" && (
                    <>
                      <Field label="Team name" htmlFor="teamName" required>
                        <input
                          id="teamName"
                          name="teamName"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                          className={inputCls}
                        />
                      </Field>

                      <Field
                        label={`Members besides you (${members.length} added, need 2 to 4)`}
                        required
                        hint="Every member receives an invitation email and must accept within 72 hours."
                      >
                        <RepeatRows<Member>
                          rows={members}
                          setRows={setMembers}
                          blank={() => ({ name: "", email: "", role: "", github: "" })}
                          columns={["Name", "Email", "Role", "GitHub"]}
                          max={4}
                          addLabel="Add a member"
                          render={(row, i, update) => (
                            <>
                              <Cell>
                                <input
                                  name={`member-name-${i}`}
                                  value={row.name}
                                  onChange={(e) => update({ name: e.target.value })}
                                  className={cellInputCls}
                                />
                              </Cell>
                              <Cell>
                                <input
                                  name={`member-email-${i}`}
                                  type="email"
                                  value={row.email}
                                  onChange={(e) => update({ email: e.target.value })}
                                  className={cellInputCls}
                                />
                              </Cell>
                              <Cell>
                                <select
                                  name={`member-role-${i}`}
                                  value={row.role}
                                  onChange={(e) => update({ role: e.target.value })}
                                  className={cellInputCls}
                                >
                                  <option value="">Select</option>
                                  {[
                                    "Developer",
                                    "Designer",
                                    "Product",
                                    "Data",
                                    "Hardware",
                                  ].map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                              </Cell>
                              <Cell>
                                <input
                                  name={`member-github-${i}`}
                                  value={row.github}
                                  onChange={(e) => update({ github: e.target.value })}
                                  className={cellInputCls}
                                />
                              </Cell>
                            </>
                          )}
                        />
                      </Field>

                      <Field
                        label="Team roster (XLSX)"
                        required
                        hint={
                          <>
                            Download{" "}
                            <a
                              href={fileHref(
                                "junction-apply",
                                "Team_Roster_Template.xlsx",
                              )}
                              className="font-semibold text-[#4c1fd7] underline underline-offset-4"
                            >
                              Team_Roster_Template.xlsx
                            </a>
                            , fill it in and upload it as{" "}
                            <strong className="font-mono">
                              TeamRoster_{teamName || "TeamName"}.xlsx
                            </strong>
                            .
                          </>
                        }
                      >
                        <FileDrop
                          name="roster"
                          accept=".xlsx"
                          maxMB={5}
                          label="Drop the completed roster here"
                          onChange={setRoster}
                          validateName={(fileName) => {
                            if (!/^TeamRoster_/.test(fileName)) {
                              return "File name must start with TeamRoster_";
                            }
                            if (teamName && !fileName.includes(teamName)) {
                              return `File name must contain the team name (${teamName}).`;
                            }
                            return null;
                          }}
                        />
                      </Field>
                    </>
                  )}

                  <Field label="Preferred track" htmlFor="track" required>
                    <select
                      id="track"
                      name="track"
                      value={track}
                      onChange={(e) => setTrack(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select…</option>
                      {TRACKS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {track === TRACKS[0] && (
                    <Field
                      label="Dataset access request"
                      htmlFor="corpus"
                      required
                      hint="Name the document corpus you intend to work on. Upstage reviews these before the event."
                    >
                      <textarea
                        id="corpus"
                        name="corpus"
                        rows={3}
                        value={corpus}
                        onChange={(e) => setCorpus(e.target.value)}
                        className={inputCls}
                        placeholder="e.g. Korean public procurement notices, 2023–2026"
                      />
                    </Field>
                  )}

                  {track === TRACKS[1] && (
                    <Field label="Sandbox key" required>
                      <label className="flex items-start gap-2 text-[13px] text-neutral-700">
                        <input
                          type="checkbox"
                          name="sandbox"
                          checked={sandbox}
                          onChange={(e) => setSandbox(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>
                          I consent to my name and email being shared with Hanmoa Bank so
                          a sandbox key can be issued before the event.
                        </span>
                      </label>
                    </Field>
                  )}

                  {track === TRACKS[2] && (
                    <Field
                      label="Hardware declaration"
                      htmlFor="hardware"
                      required
                      hint="List anything you will plug into venue power beyond a laptop. Write None if there is nothing."
                    >
                      <textarea
                        id="hardware"
                        name="hardware"
                        rows={3}
                        value={hardware}
                        onChange={(e) => setHardware(e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                  )}

                  {koreaResident && (
                    <Field
                      label="참가확약서 (HWP · 국내 참가자 필수)"
                      required
                      hint={
                        <>
                          국내 거주 참가자는{" "}
                          <a
                            href={fileHref("junction-apply", "참가확약서_국내참가자.hwp")}
                            className="font-semibold text-[#4c1fd7] underline underline-offset-4"
                          >
                            참가확약서 지정서식
                          </a>
                          을 내려받아 작성한 뒤 HWP 로 올립니다. PDF 변환본은 받지
                          않습니다. 여비 지원 계좌도 이 서식에 적습니다.
                        </>
                      }
                    >
                      <FileDrop
                        name="pledge"
                        accept=".hwp,.hwpx"
                        maxMB={10}
                        label="작성한 참가확약서를 올려주세요"
                        onChange={setPledge}
                        validateName={(fileName) =>
                          /\.(hwp|hwpx)$/i.test(fileName)
                            ? null
                            : "HWP 파일만 제출할 수 있습니다."
                        }
                      />
                    </Field>
                  )}

                  <Field label="Consents" required>
                    <div className="grid gap-2">
                      {[
                        "I confirm I can attend on site in Pohang for the full event.",
                        "I agree to the Code of Conduct in the Participant Handbook.",
                        "I consent to the processing of my personal data for this event.",
                      ].map((c) => (
                        <label
                          key={c}
                          className="flex items-start gap-2 text-[13px] text-neutral-700"
                        >
                          <input
                            type="checkbox"
                            name="consents"
                            checked={consents.includes(c)}
                            onChange={() => toggle(consents, setConsents, c)}
                            className="mt-0.5"
                          />
                          <span>{c}</span>
                        </label>
                      ))}
                    </div>
                  </Field>

                  <Callout tone="warn">
                    We do not issue visa invitation letters and do not sponsor visas.
                    Submitting this application does not create any obligation on our part
                    to support your travel.
                  </Callout>
                </Fieldset>
              )}

              <div className="mt-8 flex items-center justify-between border-t border-neutral-200 pt-5">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="rounded border border-neutral-300 px-4 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-30"
                >
                  Back
                </button>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => canNext && setStep((s) => s + 1)}
                    disabled={!canNext}
                    className="rounded bg-[#7c4dff] px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!canNext}
                    className="rounded bg-[#7c4dff] px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    Submit application
                  </button>
                )}
              </div>

              <p className="mt-6 text-center text-[12px] text-neutral-500">
                Stuck on a requirement?{" "}
                <Link
                  href="/demo/junction-apply/faq"
                  className="font-semibold text-[#4c1fd7] underline underline-offset-4"
                >
                  Check the FAQ
                </Link>
              </p>
            </form>
          )}
        </div>
      </main>

      <JunctionFooter />
    </div>
  );
}

/** 글자수 하한이 있는 서술형. 상한만 두면 한 줄짜리 답이 통과한다 */
function Essay({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const short = value.length > 0 && value.length < ESSAY_MIN;
  const over = value.length > ESSAY_MAX;
  return (
    <Field
      label={label}
      htmlFor={id}
      required
      hint={`${ESSAY_MIN}–${ESSAY_MAX} characters.`}
    >
      <textarea
        id={id}
        name={id}
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
      <p
        className={`text-right text-xs tabular-nums ${
          over || short ? "font-medium text-red-600" : "text-neutral-400"
        }`}
      >
        {value.length} / {ESSAY_MAX}
        {short && ` · ${ESSAY_MIN - value.length} more needed`}
      </p>
    </Field>
  );
}
