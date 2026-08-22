"use client";

import Link from "next/link";
import * as React from "react";

import { DemoFooter } from "../../_lib/chrome";
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
import { Breadcrumb, PortalHeader } from "../../_lib/portal";
import { getSite } from "../../_lib/sites";

const site = getSite("easy-univ");

/**
 * 원서접수 — 로그인 게이트 뒤의 5단계.
 *
 * 대학 원서접수가 실제로 이렇다. **로그인 전에는 접수 화면이 없고**, 전형을 고르면
 * 묻는 것이 갈리고, 모집단위는 단과대학을 먼저 고르지 않으면 열리지 않으며,
 * 마지막은 결제다. 결제를 끝내야 수험번호가 나온다 — 그 전까지는 접수가 아니다.
 */

const STEPS = ["전형 선택", "모집단위", "학생부", "서류", "전형료 결제"];

type TrackKey =
  "교과성적우수자" | "지역인재" | "이지인재" | "기회균형" | "논술우수자" | "실기우수자";

const TRACKS: Record<
  TrackKey,
  { fee: number; desc: string; selfIntro: boolean; minimum: string }
> = {
  교과성적우수자: {
    fee: 45_000,
    desc: "학생부 교과 100%",
    selfIntro: false,
    minimum: "2개 영역 등급 합 6 이내",
  },
  지역인재: {
    fee: 45_000,
    desc: "학생부 교과 100% · 경북·대구 소재 고교 졸업(예정)자",
    selfIntro: false,
    minimum: "2개 영역 등급 합 7 이내",
  },
  이지인재: {
    fee: 65_000,
    desc: "1단계 서류 100% (3배수) → 2단계 면접 30%",
    selfIntro: true,
    minimum: "적용하지 않음",
  },
  기회균형: {
    fee: 0,
    desc: "1단계 서류 100% (3배수) → 2단계 면접 30% · 전형료 면제",
    selfIntro: true,
    minimum: "적용하지 않음",
  },
  논술우수자: {
    fee: 70_000,
    desc: "논술 70% + 학생부 교과 30%",
    selfIntro: false,
    minimum: "2개 영역 등급 합 5 이내",
  },
  실기우수자: {
    fee: 85_000,
    desc: "실기 60% + 학생부 교과 40%",
    selfIntro: false,
    minimum: "적용하지 않음",
  },
};

const COLLEGES: Record<string, { major: string; line: string }[]> = {
  인문사회대학: [
    { major: "국어국문학과", line: "인문" },
    { major: "영어영문학과", line: "인문" },
    { major: "사학과", line: "인문" },
    { major: "심리학과", line: "인문" },
    { major: "사회복지학과", line: "인문" },
  ],
  경영경제대학: [
    { major: "경영학과", line: "인문" },
    { major: "경제학과", line: "인문" },
    { major: "회계세무학과", line: "인문" },
    { major: "국제통상학과", line: "인문" },
  ],
  공과대학: [
    { major: "기계공학과", line: "자연" },
    { major: "전기전자공학과", line: "자연" },
    { major: "신소재공학과", line: "자연" },
    { major: "화학공학과", line: "자연" },
    { major: "건축학과", line: "자연" },
  ],
  IT융합대학: [
    { major: "컴퓨터공학과", line: "자연" },
    { major: "인공지능학과", line: "자연" },
    { major: "데이터사이언스학과", line: "자연" },
    { major: "정보보호학과", line: "자연" },
  ],
  자연과학대학: [
    { major: "수학과", line: "자연" },
    { major: "물리학과", line: "자연" },
    { major: "화학과", line: "자연" },
    { major: "생명과학과", line: "자연" },
  ],
  의약학대학: [
    { major: "의예과", line: "자연" },
    { major: "약학과", line: "자연" },
    { major: "간호학과", line: "자연" },
  ],
  예술체육대학: [
    { major: "디자인학과", line: "예체능" },
    { major: "음악학과", line: "예체능" },
    { major: "체육학과", line: "예체능" },
    { major: "연극영화학과", line: "예체능" },
  ],
};

/** 요강 3항의 등급 환산표 */
const GRADE_SCORE: Record<string, number> = {
  "1": 100,
  "2": 98,
  "3": 95,
  "4": 91,
  "5": 86,
  "6": 78,
  "7": 66,
  "8": 50,
  "9": 30,
};

type Subject = { subject: string; name: string; credit: string; grade: string };

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

export default function EasyUnivApply() {
  const [account, setAccount] = React.useState<{ id: string; name: string } | null>(null);
  const [view, setView] = React.useState<"login" | "signup">("login");

  return (
    <>
      <PortalHeader
        site={site}
        nav={[
          { label: "입학안내" },
          { label: "모집요강", href: "/demo/easy-univ" },
          { label: "모집단위", href: "/demo/easy-univ/majors" },
          { label: "입학상담" },
        ]}
        utility={[
          "대학 홈",
          "ENGLISH",
          account ? `${account.name} 님 (로그아웃)` : "원서접수 로그인",
        ]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <Breadcrumb items={["홈", "원서접수", account ? "원서 작성" : "로그인"]} />

        {!account ? (
          <Gate view={view} setView={setView} onLogin={setAccount} />
        ) : (
          <ApplicationForm account={account} />
        )}
      </main>
      <DemoFooter site={site} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 로그인 게이트                                                        */
/* ------------------------------------------------------------------ */

const TAKEN = ["admin", "test", "easy", "student"];

function Gate({
  view,
  setView,
  onLogin,
}: {
  view: "login" | "signup";
  setView: (v: "login" | "signup") => void;
  onLogin: (a: { id: string; name: string }) => void;
}) {
  return (
    <div className="mt-6">
      <div className="border-b border-neutral-200 pb-5">
        <h1 className="text-[22px] font-bold text-neutral-900">
          2027학년도 수시 원서접수
        </h1>
        <p className="mt-1.5 text-[13px] text-neutral-600">
          접수 기간 2026. 9. 9.(수) 09:00 ~ 9. 11.(금) 18:00 · 인터넷 접수만 가능
        </p>
      </div>

      <div className="mt-6 flex gap-1 border-b border-neutral-200">
        {(["login", "signup"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-4 py-2.5 text-[13px] font-semibold ${
              view === v
                ? `border-b-2 border-current ${site.accentText}`
                : "text-neutral-500"
            }`}
          >
            {v === "login" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {view === "login" ? (
          <LoginForm onLogin={onLogin} onSignup={() => setView("signup")} />
        ) : (
          <SignupForm onDone={onLogin} />
        )}
      </div>

      <Callout>
        원서접수 계정은 대학 포털 계정과 다릅니다. 처음 접수하는 수험생은 회원가입 후
        이용하세요. 이 화면은 데모이며 입력값은 브라우저를 벗어나지 않습니다.
      </Callout>
    </div>
  );
}

function LoginForm({
  onLogin,
  onSignup,
}: {
  onLogin: (a: { id: string; name: string }) => void;
  onSignup: () => void;
}) {
  const [id, setId] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!id || !pw) {
          setError("아이디와 비밀번호를 입력하세요.");
          return;
        }
        // 데모다. 가입 여부를 서버에 묻지 않고, 회원가입을 거치지 않은 계정만 막는다.
        setError("등록되지 않은 아이디입니다. 회원가입 후 이용하세요.");
      }}
    >
      <Field label="아이디" htmlFor="loginId" required>
        <input
          id="loginId"
          name="loginId"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="비밀번호" htmlFor="loginPw" required>
        <input
          id="loginPw"
          name="loginPw"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className={inputCls}
        />
      </Field>
      {error && (
        <p className="text-xs font-medium text-red-600">
          {error}{" "}
          <button
            type="button"
            onClick={onSignup}
            className="underline underline-offset-4"
          >
            회원가입으로 이동
          </button>
        </p>
      )}
      <button
        type="submit"
        className={`rounded ${site.accent} px-5 py-2.5 text-[13px] font-semibold text-white`}
      >
        로그인
      </button>
      <button
        type="button"
        onClick={() => onLogin({ id: "guest", name: "체험 수험생" })}
        className="text-[12px] text-neutral-500 underline underline-offset-4"
      >
        데모 계정으로 둘러보기
      </button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: (a: { id: string; name: string }) => void }) {
  const [id, setId] = React.useState("");
  const [checked, setChecked] = React.useState<null | "ok" | "taken">(null);
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [name, setName] = React.useState("");
  const [birth, setBirth] = React.useState("");
  const [terms, setTerms] = React.useState<string[]>([]);

  const pwOk = pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
  const required = ["이용약관 동의 (필수)", "개인정보 수집·이용 동의 (필수)"];
  const ok =
    checked === "ok" &&
    pwOk &&
    pw === pw2 &&
    name &&
    birth &&
    required.every((t) => terms.includes(t));

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onDone({ id, name });
      }}
    >
      <Field label="아이디" htmlFor="signupId" required hint="4자 이상. 중복확인 필수.">
        <div className="flex gap-2">
          <input
            id="signupId"
            name="signupId"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setChecked(null);
            }}
            className={inputCls}
          />
          <button
            type="button"
            disabled={id.length < 4}
            onClick={() => setChecked(TAKEN.includes(id.toLowerCase()) ? "taken" : "ok")}
            className="shrink-0 rounded border border-neutral-300 px-3 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          >
            중복확인
          </button>
        </div>
        {checked === "ok" && (
          <p className="text-xs text-emerald-700">사용할 수 있는 아이디입니다.</p>
        )}
        {checked === "taken" && (
          <p className="text-xs font-medium text-red-600">이미 사용 중인 아이디입니다.</p>
        )}
      </Field>

      <Field
        label="비밀번호"
        htmlFor="signupPw"
        required
        hint="8자 이상, 영문과 숫자를 모두 포함"
      >
        <input
          id="signupPw"
          name="signupPw"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className={inputCls}
        />
      </Field>

      <Field label="비밀번호 확인" htmlFor="signupPw2" required>
        <input
          id="signupPw2"
          name="signupPw2"
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          className={inputCls}
        />
        {pw2 && pw !== pw2 && (
          <p className="text-xs font-medium text-red-600">
            비밀번호가 일치하지 않습니다.
          </p>
        )}
      </Field>

      <Field label="성명" htmlFor="signupName" required>
        <input
          id="signupName"
          name="signupName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
      </Field>

      <Field label="생년월일" htmlFor="signupBirth" required>
        <input
          id="signupBirth"
          name="signupBirth"
          type="date"
          value={birth}
          onChange={(e) => setBirth(e.target.value)}
          className={inputCls}
        />
      </Field>

      <Field label="약관 동의" required>
        <div className="grid gap-2">
          {[...required, "입시 정보 수신 동의 (선택)"].map((t) => (
            <label
              key={t}
              className="flex items-start gap-2 text-[13px] text-neutral-700"
            >
              <input
                type="checkbox"
                name="terms"
                checked={terms.includes(t)}
                onChange={() =>
                  setTerms((prev) =>
                    prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
                  )
                }
                className="mt-0.5"
              />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </Field>

      <button
        type="submit"
        disabled={!ok}
        className={`rounded ${site.accent} px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40`}
      >
        가입하고 원서 작성 시작
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* 원서                                                                */
/* ------------------------------------------------------------------ */

function ApplicationForm({ account }: { account: { id: string; name: string } }) {
  const [step, setStep] = React.useState(0);
  const [receipt, setReceipt] = React.useState<string | null>(null);

  /* 1 */
  const [track, setTrack] = React.useState<TrackKey | "">("");
  const [highSchoolRegion, setHighSchoolRegion] = React.useState("");
  const [equalType, setEqualType] = React.useState("");
  const [practicalEvent, setPracticalEvent] = React.useState("");

  /* 2 */
  const [college, setCollege] = React.useState("");
  const [major, setMajor] = React.useState("");
  const [otherApplications, setOtherApplications] = React.useState("0");

  /* 3 */
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [suneung, setSuneung] = React.useState({
    korean: "",
    math: "",
    english: "",
    explore: "",
  });

  /* 4 */
  const [photo, setPhoto] = React.useState<{ name: string; url: string } | null>(null);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [selfIntro, setSelfIntro] = React.useState<PickedFile[]>([]);
  const [proof, setProof] = React.useState<PickedFile[]>([]);

  /* 5 */
  const [payMethod, setPayMethod] = React.useState("");
  const [cardCompany, setCardCompany] = React.useState("");
  const [bank, setBank] = React.useState("");
  const [payAgree, setPayAgree] = React.useState(false);

  const spec = track ? TRACKS[track] : null;
  const fee = spec?.fee ?? 0;
  const line = COLLEGES[college]?.find((m) => m.major === major)?.line ?? "";

  const weighted = subjects.reduce(
    (acc, s) => {
      const credit = Number(s.credit) || 0;
      const score = GRADE_SCORE[s.grade] ?? 0;
      return { sum: acc.sum + credit * score, credit: acc.credit + credit };
    },
    { sum: 0, credit: 0 },
  );
  const converted = weighted.credit > 0 ? weighted.sum / weighted.credit : 0;

  const suneungSum = ["korean", "math", "english", "explore"]
    .map((k) => Number(suneung[k as keyof typeof suneung]))
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
    .slice(0, 2)
    .reduce((a, b) => a + b, 0);

  const regionOk =
    track !== "지역인재" || ["경상북도", "대구광역시"].includes(highSchoolRegion);

  const canNext = [
    Boolean(
      track &&
      regionOk &&
      (track !== "기회균형" || equalType) &&
      (track !== "실기우수자" || practicalEvent),
    ),
    Boolean(college && major),
    Boolean(subjects.length >= 3 && weighted.credit > 0),
    Boolean(
      photo &&
      (!spec?.selfIntro || selfIntro.length > 0) &&
      (track !== "기회균형" || proof.length > 0),
    ),
    Boolean(
      (fee === 0 && payAgree) ||
      (payMethod === "신용카드" && cardCompany && payAgree) ||
      (payMethod !== "" && payMethod !== "신용카드" && bank && payAgree),
    ),
  ][step];

  function takePhoto(file: File | undefined) {
    if (!file) return;
    if (!/\.(jpg|jpeg|png)$/i.test(file.name)) {
      setPhotoError("증명사진은 JPG 또는 PNG 만 올릴 수 있습니다.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("증명사진은 2MB 를 초과할 수 없습니다.");
      return;
    }
    setPhotoError(null);
    setPhoto({ name: file.name, url: URL.createObjectURL(file) });
  }

  if (receipt) {
    return (
      <div className="mt-6">
        <Submitted
          accent={site.accent}
          receipt={receipt}
          summary={[
            { label: "지원자", value: account.name },
            { label: "전형", value: track },
            { label: "모집단위", value: `${college} ${major}` },
            { label: "교과 환산점수", value: converted ? converted.toFixed(2) : "—" },
            { label: "전형료", value: fee === 0 ? "면제" : won(fee) },
          ]}
          onReset={() => {
            setReceipt(null);
            setStep(0);
          }}
          footer={
            <div className="mx-auto mt-6 max-w-md rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-[12px] leading-relaxed text-neutral-600">
              접수 후에는 모집단위를 변경할 수 없습니다. 1단계 발표일·면접일은 요강 붙임
              <a
                href={fileHref(site.slug, "전형일정.xlsx")}
                className="mx-1 font-semibold underline underline-offset-4"
              >
                「전형일정.xlsx」
              </a>
              를 확인하세요. 서류 제출 마감은 2026-09-15 18:00 입니다.
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="border-b border-neutral-200 pb-5">
        <h1 className="text-[22px] font-bold text-neutral-900">원서 작성</h1>
        <p className="mt-1.5 text-[13px] text-neutral-600">
          {account.name} 님 · 2027학년도 수시모집
        </p>
      </div>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (canNext) setReceipt(receiptNo("EU27"));
        }}
      >
        <Steps steps={STEPS} current={step} accent={site.accent} />

        {step === 0 && (
          <Fieldset
            legend="1. 전형 선택"
            desc="전형에 따라 제출 서류와 전형료가 달라집니다. 접수 후에는 변경할 수 없습니다."
          >
            <Field label="지원 전형" required>
              <div className="grid gap-2">
                {(Object.keys(TRACKS) as TrackKey[]).map((t) => (
                  <label
                    key={t}
                    className={`flex cursor-pointer items-start gap-3 rounded border px-4 py-3 text-[13px] ${
                      track === t
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="track"
                      value={t}
                      checked={track === t}
                      onChange={() => setTrack(t)}
                      className="mt-1"
                    />
                    <span className="flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold text-neutral-900">{t}</span>
                        <span className="text-xs text-neutral-500">
                          전형료 {TRACKS[t].fee === 0 ? "면제" : won(TRACKS[t].fee)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        {TRACKS[t].desc}
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-400">
                        수능 최저: {TRACKS[t].minimum}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </Field>

            {track === "지역인재" && (
              <Field
                label="출신 고등학교 소재지"
                htmlFor="region"
                required
                hint="경상북도 또는 대구광역시 소재 고교에서 전 교육과정을 이수해야 합니다."
              >
                <select
                  id="region"
                  name="region"
                  value={highSchoolRegion}
                  onChange={(e) => setHighSchoolRegion(e.target.value)}
                  className={inputCls}
                >
                  <option value="">선택하세요</option>
                  {[
                    "경상북도",
                    "대구광역시",
                    "서울특별시",
                    "경기도",
                    "부산광역시",
                    "그 외",
                  ].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {highSchoolRegion && !regionOk && (
                  <p className="text-xs font-medium text-red-600">
                    지역인재 전형은 경북·대구 소재 고교 졸업(예정)자만 지원할 수 있습니다.
                  </p>
                )}
              </Field>
            )}

            {track === "기회균형" && (
              <Field label="자격 구분" htmlFor="equalType" required>
                <select
                  id="equalType"
                  name="equalType"
                  value={equalType}
                  onChange={(e) => setEqualType(e.target.value)}
                  className={inputCls}
                >
                  <option value="">선택하세요</option>
                  {["국가보훈대상자", "기초생활수급자", "차상위계층", "농어촌 학생"].map(
                    (t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            )}

            {track === "실기우수자" && (
              <Field label="실기 종목" htmlFor="practicalEvent" required>
                <select
                  id="practicalEvent"
                  name="practicalEvent"
                  value={practicalEvent}
                  onChange={(e) => setPracticalEvent(e.target.value)}
                  className={inputCls}
                >
                  <option value="">선택하세요</option>
                  {[
                    "기초디자인",
                    "전공 실기(음악)",
                    "체력장 + 전공 실기",
                    "연기",
                    "영상 포트폴리오",
                  ].map((e2) => (
                    <option key={e2} value={e2}>
                      {e2}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {track && TRACKS[track].selfIntro && (
              <Callout tone="warn">
                {track} 전형은 자기소개서(지정서식 HWP)를 제출해야 합니다. 4단계에서
                업로드하며, 자유양식이나 PDF 변환본은 받지 않습니다.
              </Callout>
            )}
          </Fieldset>
        )}

        {step === 1 && (
          <Fieldset
            legend="2. 모집단위"
            desc="단과대학을 먼저 고르면 모집단위가 열립니다. 동일 전형 내 복수 모집단위 지원은 불가합니다."
          >
            <Field label="단과대학" htmlFor="college" required>
              <select
                id="college"
                name="college"
                value={college}
                onChange={(e) => {
                  setCollege(e.target.value);
                  setMajor("");
                }}
                className={inputCls}
              >
                <option value="">선택하세요</option>
                {Object.keys(COLLEGES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="모집단위"
              htmlFor="major"
              required
              hint={
                college ? (
                  <>
                    모집인원은 요강 붙임1{" "}
                    <a
                      href={fileHref(site.slug, "모집단위별_모집인원.xlsx")}
                      className="font-semibold underline underline-offset-4"
                    >
                      「모집단위별_모집인원.xlsx」
                    </a>
                    에서 확인하세요.
                  </>
                ) : (
                  "단과대학을 먼저 선택하세요."
                )
              }
            >
              <select
                id="major"
                name="major"
                value={major}
                disabled={!college}
                onChange={(e) => setMajor(e.target.value)}
                className={inputCls}
              >
                <option value="">선택하세요</option>
                {(COLLEGES[college] ?? []).map((m) => (
                  <option key={m.major} value={m.major}>
                    {m.major} ({m.line} 계열)
                  </option>
                ))}
              </select>
            </Field>

            {line && (
              <div className="rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-[13px] text-neutral-700">
                <p>
                  <strong>{line} 계열</strong>로 분류됩니다. 학생부 반영 교과는{" "}
                  {line === "인문"
                    ? "국어·영어·수학·사회"
                    : line === "자연"
                      ? "국어·영어·수학·과학"
                      : "국어·영어"}{" "}
                  입니다.
                </p>
                {track === "논술우수자" && (
                  <p className="mt-1 text-neutral-500">
                    논술고사는 {line === "인문" ? "오전 09:00" : "오후 14:00"} 에 시행되며
                    입실 완료 시각이 다릅니다.
                  </p>
                )}
              </div>
            )}

            <Field
              label="타 대학 수시 지원 횟수"
              htmlFor="otherApplications"
              hint="본교 포함 6회를 초과하면 전체 지원이 무효 처리됩니다."
            >
              <select
                id="otherApplications"
                name="otherApplications"
                value={otherApplications}
                onChange={(e) => setOtherApplications(e.target.value)}
                className={inputCls}
              >
                {["0", "1", "2", "3", "4", "5", "6 이상"].map((n) => (
                  <option key={n} value={n}>
                    {n}회
                  </option>
                ))}
              </select>
              {otherApplications === "6 이상" && (
                <p className="text-xs font-medium text-red-600">
                  본교 지원을 포함하면 6회를 초과합니다. 다른 대학 지원을 취소한 뒤
                  접수하세요.
                </p>
              )}
            </Field>
          </Fieldset>
        )}

        {step === 2 && (
          <Fieldset
            legend="3. 학생부 교과 성적"
            desc="3학년 1학기까지 반영합니다. 최소 3개 과목 이상 입력해야 다음 단계로 넘어갑니다."
          >
            <Field label="교과 성적" required>
              <RepeatRows<Subject>
                rows={subjects}
                setRows={setSubjects}
                blank={() => ({ subject: "", name: "", credit: "", grade: "" })}
                columns={["교과", "과목명", "단위수", "등급"]}
                max={20}
                addLabel="과목 추가"
                render={(row, i, update) => (
                  <>
                    <Cell>
                      <select
                        name={`subject-${i}`}
                        value={row.subject}
                        onChange={(e) => update({ subject: e.target.value })}
                        className={cellInputCls}
                      >
                        <option value="">선택</option>
                        {["국어", "영어", "수학", "사회", "과학"].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Cell>
                    <Cell>
                      <input
                        name={`subjectName-${i}`}
                        value={row.name}
                        onChange={(e) => update({ name: e.target.value })}
                        className={cellInputCls}
                        placeholder="예: 확률과 통계"
                      />
                    </Cell>
                    <Cell>
                      <input
                        name={`credit-${i}`}
                        inputMode="numeric"
                        value={row.credit}
                        onChange={(e) => update({ credit: e.target.value })}
                        className={cellInputCls}
                        placeholder="4"
                      />
                    </Cell>
                    <Cell>
                      <select
                        name={`grade-${i}`}
                        value={row.grade}
                        onChange={(e) => update({ grade: e.target.value })}
                        className={cellInputCls}
                      >
                        <option value="">선택</option>
                        {Object.keys(GRADE_SCORE).map((g) => (
                          <option key={g} value={g}>
                            {g}등급
                          </option>
                        ))}
                      </select>
                    </Cell>
                  </>
                )}
              />
            </Field>

            <div className={`${site.accentSoft} rounded px-4 py-3 text-[13px]`}>
              <p className="flex items-center justify-between font-semibold text-neutral-900">
                <span>교과 환산점수 (단위수 가중평균)</span>
                <span className="text-lg tabular-nums">
                  {converted ? converted.toFixed(2) : "—"}
                </span>
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                입력한 {subjects.length}개 과목 · 총 단위수 {weighted.credit} · 요강 3항
                환산표를 적용한 값입니다. 최종 점수는 학생부 원본으로 재산출합니다.
              </p>
            </div>

            <Field
              label="수능 예상 등급"
              hint={
                spec?.minimum === "적용하지 않음"
                  ? "이 전형은 수능 최저학력기준을 적용하지 않습니다. 입력은 참고용입니다."
                  : `이 전형의 기준: ${spec?.minimum}`
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ["korean", "국어"],
                    ["math", "수학"],
                    ["english", "영어"],
                    ["explore", "탐구"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="grid gap-1 text-xs text-neutral-600">
                    {label}
                    <select
                      name={`suneung-${key}`}
                      value={suneung[key]}
                      onChange={(e) =>
                        setSuneung((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className={inputCls}
                    >
                      <option value="">-</option>
                      {Object.keys(GRADE_SCORE).map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {suneungSum > 0 && spec?.minimum !== "적용하지 않음" && (
                <p className="text-xs text-neutral-600">
                  상위 2개 영역 등급 합 <strong>{suneungSum}</strong> · {spec?.minimum}
                </p>
              )}
            </Field>
          </Fieldset>
        )}

        {step === 3 && (
          <Fieldset
            legend="4. 서류 제출"
            desc="증명사진은 수험표에 그대로 인쇄됩니다. 서류 제출 마감은 2026-09-15 18:00 입니다."
          >
            <Field
              label="증명사진"
              htmlFor="photo"
              required
              hint="3.5 × 4.5cm 규격 · JPG 또는 PNG · 2MB 이하 · 최근 3개월 이내 촬영"
            >
              <div className="flex items-start gap-4">
                <div className="flex size-[120px] shrink-0 items-center justify-center overflow-hidden rounded border border-neutral-300 bg-neutral-50">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt="증명사진 미리보기"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] text-neutral-400">미리보기</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    id="photo"
                    name="photo"
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={(e) => takePhoto(e.target.files?.[0])}
                    className="block w-full text-[13px] text-neutral-700 file:mr-3 file:rounded file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-[13px] file:font-medium"
                  />
                  {photo && <p className="mt-2 text-xs text-neutral-500">{photo.name}</p>}
                  {photoError && (
                    <p className="mt-2 text-xs font-medium text-red-600">{photoError}</p>
                  )}
                </div>
              </div>
            </Field>

            {spec?.selfIntro && (
              <Field
                label="자기소개서 (지정서식 HWP)"
                required
                hint={
                  <>
                    요강 붙임3{" "}
                    <a
                      href={fileHref(site.slug, "자기소개서_지정서식.hwp")}
                      className="font-semibold underline underline-offset-4"
                    >
                      「자기소개서_지정서식.hwp」
                    </a>
                    을 내려받아 작성한 뒤 올리세요. 공인어학성적·교외 수상실적·부모 직업을
                    기재하면 0점 처리됩니다.
                  </>
                }
              >
                <FileDrop
                  name="selfIntro"
                  accept=".hwp,.hwpx"
                  maxMB={10}
                  label="작성한 자기소개서를 올려주세요"
                  onChange={setSelfIntro}
                  validateName={(fileName) =>
                    /\.(hwp|hwpx)$/i.test(fileName)
                      ? null
                      : "자기소개서는 HWP 파일만 제출할 수 있습니다."
                  }
                />
              </Field>
            )}

            {track === "기회균형" && (
              <Field
                label={`자격 증빙서류 (${equalType || "자격 구분 미선택"})`}
                required
                hint="발급 1개월 이내 원본 스캔본. 여러 장이면 한 파일로 합쳐 올리세요."
              >
                <FileDrop
                  name="proof"
                  accept=".pdf,.jpg,.jpeg,.png"
                  maxMB={20}
                  multiple
                  label="증빙서류를 올려주세요"
                  onChange={setProof}
                />
              </Field>
            )}

            <Callout>
              학교생활기록부는 온라인으로 연계되므로 따로 제출하지 않습니다. 검정고시
              출신자와 국외 고교 졸업자는 별도 서류가 필요하니 입학처로 문의하세요.
            </Callout>
          </Fieldset>
        )}

        {step === 4 && (
          <Fieldset
            legend="5. 전형료 결제"
            desc="결제를 완료해야 접수가 인정됩니다. 결제 전에 창을 닫으면 접수되지 않습니다."
          >
            <div className="rounded border border-neutral-200 px-4 py-4 text-[13px]">
              <dl className="grid gap-1.5 text-neutral-700">
                <div className="flex justify-between">
                  <dt>전형</dt>
                  <dd className="font-medium text-neutral-900">{track}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>모집단위</dt>
                  <dd className="font-medium text-neutral-900">
                    {college} {major}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-neutral-200 pt-2">
                  <dt className="font-semibold text-neutral-900">전형료</dt>
                  <dd className="text-[16px] font-bold text-neutral-900 tabular-nums">
                    {fee === 0 ? "면제" : won(fee)}
                  </dd>
                </div>
              </dl>
            </div>

            {fee === 0 ? (
              <Callout>
                기회균형 전형은 전형료가 면제됩니다. 아래 동의 후 제출하면 접수가
                완료됩니다.
              </Callout>
            ) : (
              <>
                <Field label="결제 수단" required>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {["신용카드", "계좌이체", "가상계좌"].map((m) => (
                      <label
                        key={m}
                        className={`flex cursor-pointer items-center gap-2 rounded border px-4 py-3 text-[13px] ${
                          payMethod === m
                            ? "border-neutral-900 bg-neutral-50 font-semibold"
                            : "border-neutral-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="payMethod"
                          value={m}
                          checked={payMethod === m}
                          onChange={() => setPayMethod(m)}
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </Field>

                {payMethod === "신용카드" && (
                  <Field label="카드사" htmlFor="cardCompany" required>
                    <select
                      id="cardCompany"
                      name="cardCompany"
                      value={cardCompany}
                      onChange={(e) => setCardCompany(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">선택하세요</option>
                      {["한모아카드", "새길카드", "온빛카드", "누리카드"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                {(payMethod === "계좌이체" || payMethod === "가상계좌") && (
                  <Field
                    label="은행"
                    htmlFor="bank"
                    required
                    hint={
                      payMethod === "가상계좌"
                        ? "발급된 가상계좌로 마감 시각 전까지 입금해야 접수가 완료됩니다."
                        : undefined
                    }
                  >
                    <select
                      id="bank"
                      name="bank"
                      value={bank}
                      onChange={(e) => setBank(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">선택하세요</option>
                      {["한모아은행", "새길은행", "온빛은행", "누리은행"].map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </>
            )}

            <label className="flex items-start gap-2 text-[13px] text-neutral-700">
              <input
                type="checkbox"
                name="payAgree"
                checked={payAgree}
                onChange={(e) => setPayAgree(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                접수 후에는 모집단위를 변경할 수 없으며, 전형료 환불은 대학입학전형 표준
                환불 기준을 따른다는 데 동의합니다.{" "}
                <span className="text-red-600">*</span>
              </span>
            </label>
          </Fieldset>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-neutral-200 pt-5">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded border border-neutral-300 px-4 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-30"
          >
            이전
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => canNext && setStep((s) => s + 1)}
              disabled={!canNext}
              className={`rounded ${site.accent} px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40`}
            >
              다음 단계
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canNext}
              className={`rounded ${site.accent} px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40`}
            >
              {fee === 0 ? "원서 제출" : `${won(fee)} 결제하고 접수`}
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-[12px] text-neutral-500">
          작성 중 막히면{" "}
          <Link
            href="/demo/easy-univ/notice/2027-susi"
            className={`font-semibold underline underline-offset-4 ${site.accentText}`}
          >
            수시모집 요강
          </Link>
          을 확인하세요.
        </p>
      </form>
    </div>
  );
}
