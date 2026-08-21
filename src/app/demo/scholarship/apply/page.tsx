"use client";

import Link from "next/link";
import * as React from "react";

import { DemoFooter, DemoHeader } from "../../_lib/chrome";
import {
  Callout,
  Field,
  Fieldset,
  FileDrop,
  inputCls,
  receiptNo,
  Submitted,
  type PickedFile,
} from "../../_lib/fields";
import { getSite } from "../../_lib/sites";

const site = getSite("scholarship");

/** 이미 선점된 아이디 — 중복확인이 실제로 실패하는 경우가 있어야 한다 */
const TAKEN = ["admin", "test", "user", "mirae", "hope"];
const STORE_KEY = "demo-scholarship-account";
const SESSION_KEY = "demo-scholarship-session";

type Account = { userId: string; password: string; name: string; email: string };

/* sessionStorage 를 외부 스토어로 구독한다 — effect 안에서 setState 하지 않기 위해서다 */
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function readKey(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    // 프라이빗 모드 등에서 접근이 막힐 수 있다. 비로그인으로 취급한다
    return null;
  }
}

function writeKey(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* 저장이 막혀도 화면은 계속 동작해야 한다 */
  }
  listeners.forEach((l) => l());
}

/** 서버 렌더와 하이드레이션 시점에는 항상 비로그인 */
const serverSnapshot = () => null;

/**
 * 신청 방식 7 — 계정이 있어야 폼이 열린다.
 *
 * 회원가입(아이디 중복확인 · 비밀번호 규칙 · 이메일 인증코드 · 약관 동의)을
 * 거쳐 로그인해야 신청서에 도달한다. 세션은 sessionStorage 에 남아 새로고침해도
 * 유지된다 — 자동화가 로그인 상태를 이어가는 상황을 재현하기 위해서다.
 *
 * 인증코드는 실제 메일 대신 화면에 표시한다. 데모에서 메일함을 여는 마찰을
 * 없애기 위한 것이고, 코드 입력 단계 자체는 그대로 남는다.
 */
export default function ScholarshipApply() {
  const [view, setView] = React.useState<"login" | "signup">("login");
  const [receipt, setReceipt] = React.useState<string | null>(null);

  const session = React.useSyncExternalStore(
    subscribe,
    () => readKey(SESSION_KEY),
    serverSnapshot,
  );
  const accountRaw = React.useSyncExternalStore(
    subscribe,
    () => readKey(STORE_KEY),
    serverSnapshot,
  );

  // 저장된 계정 — 데모라 브라우저 안에만 있다
  const account = React.useMemo<Account | null>(() => {
    if (!accountRaw) return null;
    try {
      return JSON.parse(accountRaw) as Account;
    } catch {
      return null;
    }
  }, [accountRaw]);

  const persist = (next: Account) => writeKey(STORE_KEY, JSON.stringify(next));
  const login = (userId: string) => writeKey(SESSION_KEY, userId);
  const logout = () => writeKey(SESSION_KEY, null);

  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "재단소개" },
          { label: "장학사업" },
          { label: "온라인신청", active: true },
        ]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/demo/${site.slug}`}
            className="text-[13px] text-neutral-500 underline underline-offset-4"
          >
            ← 공고문으로
          </Link>
          {session && (
            <div className="flex items-center gap-3 text-[13px]">
              <span className="text-neutral-600">
                <strong className="text-neutral-900">{account?.name ?? session}</strong>{" "}
                님 로그인 중
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>

        <h1 className="mt-3 mb-8 text-xl font-bold">
          2026학년도 2학기 성적우수 장학생 신청
        </h1>

        {session ? (
          receipt ? (
            <Submitted
              accent={site.accent}
              receipt={receipt}
              summary={[
                { label: "신청자", value: account?.name ?? session },
                { label: "계정", value: session },
                { label: "통지 이메일", value: account?.email ?? "" },
              ]}
              onReset={() => setReceipt(null)}
            />
          ) : (
            <ApplicationForm
              onDone={() => {
                setReceipt(receiptNo("MHF"));
                window.scrollTo({ top: 0 });
              }}
            />
          )
        ) : (
          <div>
            <div className="mb-6 flex border-b border-neutral-200">
              {(["login", "signup"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`border-b-2 px-4 py-2.5 text-[13px] font-medium ${
                    view === v
                      ? `border-current ${site.accentText}`
                      : "border-transparent text-neutral-500"
                  }`}
                >
                  {v === "login" ? "로그인" : "회원가입"}
                </button>
              ))}
            </div>

            <Callout>
              신청서는 <strong>로그인 후에만</strong> 열립니다. 회원가입 시 입력한
              이메일로 인증을 완료해야 하며, 선발 결과도 해당 이메일로 통지됩니다.
            </Callout>

            <div className="mt-6">
              {view === "login" ? (
                <LoginForm
                  account={account}
                  onSuccess={login}
                  onGoSignup={() => setView("signup")}
                />
              ) : (
                <SignupForm
                  onSuccess={(a) => {
                    persist(a);
                    setView("login");
                  }}
                />
              )}
            </div>
          </div>
        )}
      </main>
      <DemoFooter site={site} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function LoginForm({
  account,
  onSuccess,
  onGoSignup,
}: {
  account: Account | null;
  onSuccess: (userId: string) => void;
  onGoSignup: () => void;
}) {
  const [userId, setUserId] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) {
      setError("가입된 계정이 없습니다. 회원가입을 먼저 진행하세요.");
      return;
    }
    if (account.userId !== userId || account.password !== password) {
      setError("아이디 또는 비밀번호가 일치하지 않습니다.");
      return;
    }
    setError(null);
    onSuccess(userId);
  }

  return (
    <form onSubmit={submit} className="grid max-w-sm gap-5">
      <Field label="아이디" htmlFor="loginId" required>
        <input
          id="loginId"
          name="loginId"
          autoComplete="username"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="비밀번호" htmlFor="loginPw" required>
        <input
          id="loginPw"
          name="loginPw"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </Field>
      {error && (
        <p className="text-[13px] font-medium text-red-600">
          {error}{" "}
          {!account && (
            <button type="button" onClick={onGoSignup} className="underline">
              회원가입하기
            </button>
          )}
        </p>
      )}
      <button
        type="submit"
        disabled={!userId || !password}
        className={`${getSite("scholarship").accent} rounded px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40`}
      >
        로그인
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function SignupForm({ onSuccess }: { onSuccess: (a: Account) => void }) {
  const site = getSite("scholarship");

  const [userId, setUserId] = React.useState("");
  const [idChecked, setIdChecked] = React.useState<null | "ok" | "taken">(null);
  const [password, setPassword] = React.useState("");
  const [password2, setPassword2] = React.useState("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");

  // 코드 자체는 서버가 쥔다. 여기엔 "어느 주소로 보냈는지"만 남는다.
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [expiresIn, setExpiresIn] = React.useState<number | null>(null);
  /** SMTP 미설정 개발 환경에서만 서버가 내려준다 */
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [codeInput, setCodeInput] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [verified, setVerified] = React.useState(false);
  const [codeError, setCodeError] = React.useState<string | null>(null);

  const [terms, setTerms] = React.useState<string[]>([]);

  const pwLongEnough = password.length >= 8;
  const pwHasLetter = /[A-Za-z]/.test(password);
  const pwHasDigit = /\d/.test(password);
  const pwHasSymbol = /[^A-Za-z0-9]/.test(password);
  const pwOk = pwLongEnough && pwHasLetter && pwHasDigit && pwHasSymbol;
  const pwMatch = password !== "" && password === password2;

  const requiredTerms = ["이용약관 동의 (필수)", "개인정보 수집·이용 동의 (필수)"];
  const termsOk = requiredTerms.every((t) => terms.includes(t));

  const ok = idChecked === "ok" && pwOk && pwMatch && name && verified && termsOk;

  function checkId() {
    if (userId.length < 4) return;
    setIdChecked(TAKEN.includes(userId.toLowerCase()) ? "taken" : "ok");
  }

  async function sendCode() {
    if (!email.includes("@") || sending) return;
    setSending(true);
    setCodeError(null);
    setCodeInput("");
    setVerified(false);
    try {
      const res = await fetch("/api/demo/email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCodeError(data.error ?? "발송에 실패했습니다.");
        setSentTo(null);
        return;
      }
      setSentTo(email);
      setExpiresIn(data.expiresInMinutes ?? null);
      // 응답에 코드가 실려오는 건 SMTP 미설정 개발 환경뿐이다
      setDevCode(data.sent ? null : (data.devCode ?? null));
    } catch {
      setCodeError("네트워크 오류로 발송하지 못했습니다.");
    } finally {
      setSending(false);
    }
  }

  async function verify() {
    if (!sentTo || verifying) return;
    setVerifying(true);
    try {
      const res = await fetch("/api/demo/email-code/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sentTo, code: codeInput }),
      });
      const data = await res.json();
      if (data.verified) {
        setVerified(true);
        setCodeError(null);
      } else {
        setCodeError(data.error ?? "인증코드가 일치하지 않습니다.");
      }
    } catch {
      setCodeError("네트워크 오류로 확인하지 못했습니다.");
    } finally {
      setVerifying(false);
    }
  }

  function toggleTerm(t: string) {
    setTerms((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    onSuccess({ userId, password, name, email });
  }

  return (
    <form onSubmit={submit} className="grid gap-8">
      <Fieldset legend="계정 정보">
        <Field
          label="아이디"
          htmlFor="signupId"
          required
          hint="4자 이상. 중복확인을 해야 가입할 수 있습니다."
        >
          <div className="flex gap-2">
            <input
              id="signupId"
              name="signupId"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setIdChecked(null);
              }}
              className={inputCls}
            />
            <button
              type="button"
              onClick={checkId}
              disabled={userId.length < 4}
              className="shrink-0 rounded border border-neutral-400 bg-white px-3 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
            >
              중복확인
            </button>
          </div>
          {idChecked === "ok" && (
            <p className="text-xs font-medium text-green-700">
              사용 가능한 아이디입니다.
            </p>
          )}
          {idChecked === "taken" && (
            <p className="text-xs font-medium text-red-600">
              이미 사용 중인 아이디입니다.
            </p>
          )}
        </Field>

        <Field label="비밀번호" htmlFor="signupPw" required>
          <input
            id="signupPw"
            name="signupPw"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
          <ul className="mt-1 grid gap-0.5 text-xs">
            {[
              ["8자 이상", pwLongEnough],
              ["영문 포함", pwHasLetter],
              ["숫자 포함", pwHasDigit],
              ["특수문자 포함", pwHasSymbol],
            ].map(([label, met]) => (
              <li
                key={label as string}
                className={met ? "text-green-700" : "text-neutral-400"}
              >
                {met ? "✓" : "·"} {label as string}
              </li>
            ))}
          </ul>
        </Field>

        <Field
          label="비밀번호 확인"
          htmlFor="signupPw2"
          required
          hint={
            password2 && !pwMatch ? (
              <span className="font-medium text-red-600">
                비밀번호가 일치하지 않습니다.
              </span>
            ) : undefined
          }
        >
          <input
            id="signupPw2"
            name="signupPw2"
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className={inputCls}
          />
        </Field>
      </Fieldset>

      <Fieldset legend="본인 확인" desc="선발 결과는 인증한 이메일로 통지됩니다.">
        <Field label="성명" htmlFor="signupName" required>
          <input
            id="signupName"
            name="signupName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="이메일" htmlFor="signupEmail" required>
          <div className="flex gap-2">
            <input
              id="signupEmail"
              name="signupEmail"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSentTo(null);
                setDevCode(null);
                setVerified(false);
                setCodeError(null);
              }}
              className={inputCls}
            />
            <button
              type="button"
              onClick={sendCode}
              disabled={!email.includes("@") || !name || sending}
              className="shrink-0 rounded border border-neutral-400 bg-white px-3 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
            >
              {sending ? "발송 중…" : sentTo ? "재발송" : "인증코드 발송"}
            </button>
          </div>
        </Field>

        {sentTo && !verified && (
          <div className="rounded border border-neutral-300 bg-neutral-50 p-4">
            <p className="text-[13px] text-neutral-700">
              <strong className="text-neutral-900">{sentTo}</strong> 로 인증코드를
              보냈습니다. 메일함을 확인하세요
              {expiresIn ? ` (유효시간 ${expiresIn}분)` : ""}. 메일이 보이지 않으면
              스팸함도 확인해 주세요.
            </p>
            {devCode && (
              <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
                SMTP 가 설정되지 않아 메일을 보내지 못했습니다. 개발 환경이라 코드를 여기
                표시합니다 —{" "}
                <strong className="font-mono tracking-widest">{devCode}</strong>
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <input
                id="signupCode"
                name="signupCode"
                inputMode="numeric"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                className={inputCls}
                placeholder="6자리 인증코드"
              />
              <button
                type="button"
                onClick={verify}
                disabled={codeInput.length !== 6 || verifying}
                className="shrink-0 rounded border border-neutral-400 bg-white px-3 text-xs font-medium text-neutral-800 disabled:opacity-40"
              >
                {verifying ? "확인 중…" : "확인"}
              </button>
            </div>
            {codeError && (
              <p className="mt-2 text-xs font-medium text-red-600">{codeError}</p>
            )}
          </div>
        )}

        {verified && (
          <p className="text-[13px] font-medium text-green-700">
            ✓ 이메일 인증이 완료되었습니다.
          </p>
        )}
      </Fieldset>

      <Fieldset legend="약관 동의">
        <div className="grid gap-2">
          {[
            "이용약관 동의 (필수)",
            "개인정보 수집·이용 동의 (필수)",
            "장학사업 안내 메일 수신 동의 (선택)",
          ].map((t) => (
            <label key={t} className="flex items-start gap-2 text-[13px]">
              <input
                type="checkbox"
                name="terms"
                value={t}
                checked={terms.includes(t)}
                onChange={() => toggleTerm(t)}
                className="mt-0.5"
              />
              <span className="text-neutral-700">{t}</span>
            </label>
          ))}
        </div>
        {!termsOk && terms.length > 0 && (
          <p className="text-xs font-medium text-red-600">
            필수 약관에 모두 동의해야 합니다.
          </p>
        )}
      </Fieldset>

      <div className="flex justify-end border-t border-neutral-200 pt-5">
        <button
          type="submit"
          disabled={!ok}
          className={`${site.accent} rounded px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40`}
        >
          가입하고 로그인 화면으로
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function ApplicationForm({ onDone }: { onDone: () => void }) {
  const site = getSite("scholarship");

  const [school, setSchool] = React.useState("");
  const [major, setMajor] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [credits, setCredits] = React.useState("");
  const [gpa, setGpa] = React.useState("");
  const [bracket, setBracket] = React.useState("");
  const [bank, setBank] = React.useState("");
  const [accountNo, setAccountNo] = React.useState("");
  const [activity, setActivity] = React.useState("");
  const [otherScholarship, setOtherScholarship] = React.useState("");

  const [transcript, setTranscript] = React.useState<PickedFile[]>([]);
  const [enrollment, setEnrollment] = React.useState<PickedFile[]>([]);
  const [bracketDoc, setBracketDoc] = React.useState<PickedFile[]>([]);
  const [recommendation, setRecommendation] = React.useState<PickedFile[]>([]);
  const [bankbook, setBankbook] = React.useState<PickedFile[]>([]);
  const [agreed, setAgreed] = React.useState(false);

  const gpaLow = gpa !== "" && Number(gpa) < 3.5;
  const creditsLow = credits !== "" && Number(credits) < 12;
  const bracketHigh = bracket !== "" && Number(bracket) > 8;
  const blocked = gpaLow || creditsLow || bracketHigh || otherScholarship === "수혜 중";

  const ok =
    school &&
    major &&
    grade &&
    credits &&
    gpa &&
    bracket &&
    bank &&
    accountNo &&
    otherScholarship &&
    !blocked &&
    transcript.length > 0 &&
    enrollment.length > 0 &&
    bracketDoc.length > 0 &&
    recommendation.length > 0 &&
    bankbook.length > 0 &&
    agreed;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-8">
      <Callout>
        <strong>한 계정당 1회만</strong> 신청할 수 있으며 제출 후 수정이 불가능합니다.
      </Callout>

      <Fieldset legend="학적 정보">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="대학명" htmlFor="school" required>
            <input
              id="school"
              name="school"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="학과" htmlFor="major" required>
            <input
              id="major"
              name="major"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field
            label="학년"
            htmlFor="grade"
            required
            hint="신입생(1학년 1학기)은 신청 불가"
          >
            <select
              id="grade"
              name="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className={inputCls}
            >
              <option value="">선택하세요</option>
              <option>1학년 2학기</option>
              <option>2학년</option>
              <option>3학년</option>
              <option>4학년</option>
            </select>
          </Field>
          <Field
            label="직전 학기 이수학점"
            htmlFor="credits"
            required
            hint="12학점 이상이어야 합니다."
          >
            <input
              id="credits"
              name="credits"
              type="number"
              min={0}
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field
            label="직전 학기 평점평균"
            htmlFor="gpa"
            required
            hint="4.5 만점 기준 3.5 이상"
          >
            <input
              id="gpa"
              name="gpa"
              type="number"
              step="0.01"
              min={0}
              max={4.5}
              value={gpa}
              onChange={(e) => setGpa(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field
            label="학자금 지원구간"
            htmlFor="bracket"
            required
            hint="8구간 이하만 신청할 수 있습니다."
          >
            <select
              id="bracket"
              name="bracket"
              value={bracket}
              onChange={(e) => setBracket(e.target.value)}
              className={inputCls}
            >
              <option value="">선택하세요</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}구간
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="타 재단 장학금 수혜 여부" htmlFor="otherScholarship" required>
          <select
            id="otherScholarship"
            name="otherScholarship"
            value={otherScholarship}
            onChange={(e) => setOtherScholarship(e.target.value)}
            className={inputCls}
          >
            <option value="">선택하세요</option>
            <option>미수혜</option>
            <option>국가장학금 Ⅰ유형만 수혜</option>
            <option>수혜 중</option>
          </select>
        </Field>

        {blocked && (
          <Callout tone="warn">
            {creditsLow && (
              <p>직전 학기 이수학점이 12학점 미만이어서 신청할 수 없습니다.</p>
            )}
            {gpaLow && <p>평점평균이 3.5 미만이어서 신청할 수 없습니다.</p>}
            {bracketHigh && <p>학자금 지원구간이 8구간을 초과하여 신청할 수 없습니다.</p>}
            {otherScholarship === "수혜 중" && (
              <p>타 재단 장학금과 중복 수혜할 수 없습니다.</p>
            )}
          </Callout>
        )}
      </Fieldset>

      <Fieldset
        legend="봉사·활동 실적"
        desc="최근 2년 이내 실적만 인정됩니다 (10% 반영)."
      >
        <Field label="활동 내역" htmlFor="activity">
          <textarea
            id="activity"
            name="activity"
            rows={5}
            maxLength={600}
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            className={inputCls}
            placeholder="기간 · 기관 · 활동 내용 순으로 작성하세요."
          />
        </Field>
      </Fieldset>

      <Fieldset
        legend="제출 서류"
        desc="모두 필수입니다. 위·변조 시 5년간 신청이 제한됩니다."
      >
        <Field label="성적증명서" required hint="직전 학기 포함 · 발급 1개월 이내">
          <FileDrop name="transcript" accept=".pdf" maxMB={10} onChange={setTranscript} />
        </Field>
        <Field label="재학증명서" required hint="발급 1개월 이내">
          <FileDrop name="enrollment" accept=".pdf" maxMB={10} onChange={setEnrollment} />
        </Field>
        <Field
          label="학자금 지원구간 통지서"
          required
          hint="한국장학재단 발급 · 당해 학기 기준"
        >
          <FileDrop name="bracketDoc" accept=".pdf" maxMB={10} onChange={setBracketDoc} />
        </Field>
        <Field label="지도교수 추천서" required hint="지정양식 · 스캔본 제출">
          <FileDrop
            name="recommendation"
            accept=".pdf,.jpg,.jpeg,.png"
            maxMB={10}
            onChange={setRecommendation}
          />
        </Field>
        <Field label="통장 사본" required hint="본인 명의 계좌">
          <FileDrop
            name="bankbook"
            accept=".pdf,.jpg,.jpeg,.png"
            maxMB={5}
            onChange={setBankbook}
          />
        </Field>
      </Fieldset>

      <Fieldset legend="장학금 입금 계좌">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="은행" htmlFor="bank" required>
            <select
              id="bank"
              name="bank"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className={inputCls}
            >
              <option value="">선택하세요</option>
              <option>국민은행</option>
              <option>신한은행</option>
              <option>우리은행</option>
              <option>하나은행</option>
              <option>농협은행</option>
              <option>대구은행</option>
            </select>
          </Field>
          <Field label="계좌번호" htmlFor="accountNo" required hint="- 없이 숫자만">
            <input
              id="accountNo"
              name="accountNo"
              inputMode="numeric"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <label className="flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            name="agree"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-neutral-700">
            기재 사항이 사실이며, 선발 후 휴학하거나 평점평균이 3.0 미만으로 하락하면
            지급이 중단되고 기지급액이 환수될 수 있음을 확인했습니다.{" "}
            <span className="text-red-600">*</span>
          </span>
        </label>
      </Fieldset>

      <div className="flex justify-end border-t border-neutral-200 pt-5">
        <button
          type="submit"
          disabled={!ok}
          className={`${site.accent} rounded px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40`}
        >
          장학금 신청
        </button>
      </div>
    </form>
  );
}
