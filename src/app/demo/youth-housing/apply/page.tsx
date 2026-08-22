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
import { Breadcrumb, PortalHeader } from "../../_lib/portal";
import { getSite } from "../../_lib/sites";

const site = getSite("youth-housing");

/**
 * 청약 신청 — 5단계.
 *
 * 마찰을 넷 넣었다. **본인확인 없이는 1단계를 못 넘고**(대리 청약 불가가 화면에서
 * 강제된다), 유형을 고르면 질문이 갈리고, 소득은 가구원 수에 걸린 표와 실시간으로
 * 대조되며, 마지막 업로드는 파일명 규칙을 본다. 텍스트만 채우는 폼으로는 이 중
 * 어느 것도 재현되지 않는다.
 */

const STEPS = ["본인확인", "유형 선택", "주택형", "소득·자산", "서류·제출"];

/** 붙임4 소득·자산 기준표와 같은 값이어야 한다 */
const INCOME: Record<number, number> = {
  1: 3_482_964,
  2: 5_415_712,
  3: 7_198_649,
  4: 8_248_467,
  5: 8_701_639,
  6: 9_438_844,
};

const UNITS = {
  "16A": { area: "16.98㎡", deposit: 21_000_000, rent: 197_000, total: 96 },
  "19B": { area: "19.44㎡", deposit: 25_900_000, rent: 241_000, total: 128 },
  "24C": { area: "24.36㎡", deposit: 33_800_000, rent: 312_000, total: 120 },
  "31D": { area: "31.72㎡", deposit: 44_100_000, rent: 408_000, total: 68 },
} as const;

type UnitKey = keyof typeof UNITS;

const FLOOR_ADJUST: Record<string, number> = {
  "저층 (3~5층)": -0.03,
  "중층 (6~12층)": 0,
  "고층 (13~18층)": 0.03,
};

const ASSET_CAP: Record<string, number> = {
  청년: 273_000_000,
  신혼부부: 337_000_000,
  고령자: 337_000_000,
};

const INCOME_CAP: Record<string, number> = { 청년: 1.2, 신혼부부: 1.3, 고령자: 1.0 };

type Member = { relation: string; name: string; birth: string; house: string };

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

export default function YouthHousingApply() {
  const [step, setStep] = React.useState(0);
  const [receipt, setReceipt] = React.useState<string | null>(null);

  /* 1단계 */
  const [name, setName] = React.useState("");
  const [birth, setBirth] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [sentCode, setSentCode] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [verified, setVerified] = React.useState(false);
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [noHouse, setNoHouse] = React.useState(false);

  /* 2단계 */
  const [type, setType] = React.useState("");
  const [married, setMarried] = React.useState("");
  const [firstJob, setFirstJob] = React.useState("");
  const [weddingDate, setWeddingDate] = React.useState("");
  const [dualIncome, setDualIncome] = React.useState("");
  const [children, setChildren] = React.useState("0");
  const [special, setSpecial] = React.useState(false);

  /* 3단계 */
  const [line, setLine] = React.useState("");
  const [unit1, setUnit1] = React.useState<UnitKey | "">("");
  const [unit2, setUnit2] = React.useState<UnitKey | "">("");
  const [floor, setFloor] = React.useState("");
  const [convert, setConvert] = React.useState("전환하지 않음");

  /* 4단계 */
  const [household, setHousehold] = React.useState("1");
  const [income, setIncome] = React.useState("");
  const [assets, setAssets] = React.useState("");
  const [hasCar, setHasCar] = React.useState("아니오");
  const [carValue, setCarValue] = React.useState("");
  const [members, setMembers] = React.useState<Member[]>([]);
  const [residence, setResidence] = React.useState("");
  const [homeless, setHomeless] = React.useState("");

  /* 5단계 */
  const [formFile, setFormFile] = React.useState<PickedFile[]>([]);
  const [agree, setAgree] = React.useState<string[]>([]);

  const capRatio = INCOME_CAP[type] ?? 1;
  const base = INCOME[Number(household)] ?? INCOME[1];
  const limit = Math.round(
    base * (type === "신혼부부" && dualIncome === "예" ? 1.4 : capRatio),
  );
  const incomeNum = Number(income.replace(/[^\d]/g, "")) || 0;
  const assetNum = Number(assets.replace(/[^\d]/g, "")) || 0;
  const carNum = Number(carValue.replace(/[^\d]/g, "")) || 0;
  const incomeOver = incomeNum > 0 && incomeNum > limit;
  const assetOver = assetNum > 0 && assetNum > (ASSET_CAP[type] ?? Infinity);
  const carOver = hasCar === "예" && carNum > 38_030_000;

  const points =
    (residence === "3년 이상" ? 3 : residence === "1년 이상 3년 미만" ? 2 : 0) +
    (homeless === "3년 이상" ? 3 : homeless === "1년 이상 3년 미만" ? 2 : 0) +
    Math.min(Number(children) || 0, 2) +
    (firstJob === "예" ? 2 : 0);

  const rent1 =
    unit1 && floor
      ? Math.round((UNITS[unit1].rent * (1 + (FLOOR_ADJUST[floor] ?? 0))) / 1000) * 1000
      : 0;

  const expectedFileName =
    name && unit1 ? `청약신청서_${name}_${unit1}.hwp` : "청약신청서_성명_주택형.hwp";

  const canNext = [
    Boolean(name && birth && phone && verified && noHouse),
    Boolean(
      type &&
      (type !== "청년" || married === "미혼") &&
      (type !== "신혼부부" || (weddingDate && dualIncome)),
    ),
    Boolean(line && unit1 && floor),
    Boolean(
      household &&
      income !== "" &&
      assets !== "" &&
      residence &&
      homeless &&
      !incomeOver &&
      !assetOver &&
      !carOver &&
      members.length === Number(household) - 1,
    ),
    Boolean(formFile.length > 0 && agree.length === 2),
  ][step];

  function sendCode() {
    // 데모다. 실제 문자를 보내지 않고 화면에 코드를 보여준다.
    setSentCode("468213");
    setVerified(false);
    setCode("");
    setCodeError(null);
  }

  function verify() {
    if (code === sentCode) {
      setVerified(true);
      setCodeError(null);
    } else {
      setCodeError("인증번호가 일치하지 않습니다.");
    }
  }

  function toggleAgree(t: string) {
    setAgree((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canNext) return;
    setReceipt(receiptNo("SGH"));
  }

  function reset() {
    setReceipt(null);
    setStep(0);
  }

  return (
    <>
      <PortalHeader
        site={site}
        nav={[
          { label: "공사소개" },
          { label: "임대주택", href: "/demo/youth-housing" },
          { label: "청약안내", href: "/demo/youth-housing/faq" },
          { label: "고객지원" },
        ]}
        utility={["사이트맵", "ENGLISH", verified ? `${name} 님` : "로그인"]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <Breadcrumb items={["홈", "임대주택", "온라인 청약", "신청서 작성"]} />

        {receipt ? (
          <div className="mt-6">
            <Submitted
              accent={site.accent}
              receipt={receipt}
              summary={[
                { label: "단지", value: "한빛스테이 장량" },
                { label: "신청자", value: name },
                { label: "신청 유형", value: special ? `${type} (특별공급)` : type },
                {
                  label: "희망 주택형",
                  value: [unit1, unit2].filter(Boolean).join(" · "),
                },
                { label: "가점 합계", value: `${points}점 / 10점` },
              ]}
              onReset={reset}
              footer={
                <div className="mx-auto mt-6 max-w-md rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-[12px] leading-relaxed text-neutral-600">
                  서류제출대상자 발표일과 제출 기한은 공고 상세의 붙임3 「공급일정표」에서
                  확인하세요. 기한을 넘기면 부적격 처리되며 예비순번도 부여되지 않습니다.
                </div>
              }
            />
          </div>
        ) : (
          <>
            <div className="mt-4 border-b border-neutral-200 pb-5">
              <h1 className="text-[22px] font-bold text-neutral-900">
                온라인 청약 신청서
              </h1>
              <p className="mt-1.5 text-[13px] text-neutral-600">
                한빛스테이 장량 · 공고번호 2026-민간임대-0087
              </p>
              <p className="mt-1 text-[12px] text-neutral-500">
                접수 기간은{" "}
                <Link
                  href="/demo/youth-housing/notice/2026-0087"
                  className="underline underline-offset-4"
                >
                  공고 상세
                </Link>
                의 붙임3 「공급일정표」를 따릅니다.
              </p>
            </div>

            <form onSubmit={submit} className="mt-8">
              <Steps steps={STEPS} current={step} accent={site.accent} />

              {step === 0 && (
                <Fieldset
                  legend="1. 본인확인"
                  desc="대리 청약은 인정되지 않습니다. 본인 명의 휴대폰으로 인증해야 접수됩니다."
                >
                  <Field label="성명" htmlFor="name" required>
                    <input
                      id="name"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputCls}
                      placeholder="주민등록상 성명"
                    />
                  </Field>
                  <Field label="생년월일" htmlFor="birth" required>
                    <input
                      id="birth"
                      name="birth"
                      type="date"
                      value={birth}
                      onChange={(e) => setBirth(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field
                    label="휴대전화"
                    htmlFor="phone"
                    required
                    hint="숫자만 입력하세요. 인증번호가 이 번호로 발송됩니다."
                  >
                    <div className="flex gap-2">
                      <input
                        id="phone"
                        name="phone"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={inputCls}
                        placeholder="01000000000"
                      />
                      <button
                        type="button"
                        onClick={sendCode}
                        disabled={phone.replace(/\D/g, "").length < 10}
                        className="shrink-0 rounded border border-neutral-300 px-3 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                      >
                        인증번호 발송
                      </button>
                    </div>
                  </Field>

                  {sentCode && (
                    <Field label="인증번호" htmlFor="code" required>
                      <div className="flex gap-2">
                        <input
                          id="code"
                          name="code"
                          inputMode="numeric"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          className={inputCls}
                          placeholder="6자리"
                          disabled={verified}
                        />
                        <button
                          type="button"
                          onClick={verify}
                          disabled={verified || code.length !== 6}
                          className="shrink-0 rounded border border-neutral-300 px-3 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                        >
                          {verified ? "인증완료" : "확인"}
                        </button>
                      </div>
                      {!verified && (
                        <Callout>
                          데모 환경입니다. 실제 문자는 발송되지 않으며 인증번호는{" "}
                          <strong className="font-mono">{sentCode}</strong> 입니다.
                        </Callout>
                      )}
                      {codeError && (
                        <p className="text-xs font-medium text-red-600">{codeError}</p>
                      )}
                    </Field>
                  )}

                  <label className="flex items-start gap-2 text-[13px] text-neutral-700">
                    <input
                      type="checkbox"
                      name="noHouse"
                      checked={noHouse}
                      onChange={(e) => setNoHouse(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      공고일(2026.08.24) 현재 본인은 무주택자이며, 분양권·입주권도
                      보유하고 있지 않음을 확인합니다.{" "}
                      <span className="text-red-600">*</span>
                    </span>
                  </label>
                </Fieldset>
              )}

              {step === 1 && (
                <Fieldset
                  legend="2. 신청 유형"
                  desc="유형에 따라 소득·자산 기준과 추가 질문이 달라집니다."
                >
                  <Field label="신청 유형" required>
                    <div className="grid gap-2">
                      {(["청년", "신혼부부", "고령자"] as const).map((t) => (
                        <label
                          key={t}
                          className={`flex cursor-pointer items-start gap-3 rounded border px-4 py-3 text-[13px] ${
                            type === t
                              ? "border-neutral-900 bg-neutral-50"
                              : "border-neutral-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="applyType"
                            value={t}
                            checked={type === t}
                            onChange={() => setType(t)}
                            className="mt-1"
                          />
                          <span>
                            <span className="block font-semibold text-neutral-900">
                              {t}
                            </span>
                            <span className="block text-xs text-neutral-500">
                              {t === "청년" &&
                                "만 19~39세 미혼 · 소득 120% 이하 · 자산 2억 7,300만원 이하"}
                              {t === "신혼부부" &&
                                "혼인 7년 이내 또는 예비 · 소득 130%(맞벌이 140%) 이하"}
                              {t === "고령자" && "만 65세 이상 · 소득 100% 이하"}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </Field>

                  {type === "청년" && (
                    <>
                      <Field label="혼인 여부" htmlFor="married" required>
                        <select
                          id="married"
                          name="married"
                          value={married}
                          onChange={(e) => setMarried(e.target.value)}
                          className={inputCls}
                        >
                          <option value="">선택하세요</option>
                          <option value="미혼">미혼</option>
                          <option value="기혼">기혼</option>
                        </select>
                      </Field>
                      {married === "기혼" && (
                        <Callout tone="warn">
                          청년 유형은 미혼자만 신청할 수 있습니다. 신혼부부 유형을
                          확인하세요.
                        </Callout>
                      )}
                      <Field
                        label="최초 취업 5년 이내 또는 취업준비생"
                        htmlFor="firstJob"
                        hint="해당하면 가점 2점이 부여됩니다. 서류제출 단계에서 증빙이 필요합니다."
                      >
                        <select
                          id="firstJob"
                          name="firstJob"
                          value={firstJob}
                          onChange={(e) => setFirstJob(e.target.value)}
                          className={inputCls}
                        >
                          <option value="">선택하세요</option>
                          <option value="예">예</option>
                          <option value="아니오">아니오</option>
                        </select>
                      </Field>
                    </>
                  )}

                  {type === "신혼부부" && (
                    <>
                      <Field
                        label="혼인신고일"
                        htmlFor="weddingDate"
                        required
                        hint="예비신혼부부는 혼인 예정일을 입력하세요."
                      >
                        <input
                          id="weddingDate"
                          name="weddingDate"
                          type="date"
                          value={weddingDate}
                          onChange={(e) => setWeddingDate(e.target.value)}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="맞벌이 여부" htmlFor="dualIncome" required>
                        <select
                          id="dualIncome"
                          name="dualIncome"
                          value={dualIncome}
                          onChange={(e) => setDualIncome(e.target.value)}
                          className={inputCls}
                        >
                          <option value="">선택하세요</option>
                          <option value="예">예 (소득 기준 140% 적용)</option>
                          <option value="아니오">아니오 (130% 적용)</option>
                        </select>
                      </Field>
                      <Field label="미성년 자녀 수" htmlFor="children">
                        <select
                          id="children"
                          name="children"
                          value={children}
                          onChange={(e) => setChildren(e.target.value)}
                          className={inputCls}
                        >
                          {["0", "1", "2", "3"].map((c) => (
                            <option key={c} value={c}>
                              {c}명
                            </option>
                          ))}
                        </select>
                      </Field>
                    </>
                  )}

                  {type === "고령자" && (
                    <Callout>
                      고령자 유형은 공고일 현재 만 65세 이상이어야 합니다. 입력하신
                      생년월일({birth || "미입력"})로 자동 확인되며, 서류제출 단계에서
                      주민등록표 등본으로 대조합니다.
                    </Callout>
                  )}

                  <label className="flex items-start gap-2 text-[13px] text-neutral-700">
                    <input
                      type="checkbox"
                      name="special"
                      checked={special}
                      onChange={(e) => setSpecial(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      특별공급에 신청합니다. 탈락하더라도 별도 신청 없이 일반공급 추첨에
                      자동 포함됩니다.
                    </span>
                  </label>
                </Fieldset>
              )}

              {step === 2 && (
                <Fieldset
                  legend="3. 희망 주택형"
                  desc="1순위에서 탈락하면 2순위 잔여 세대로 한 번 더 추첨합니다."
                >
                  <Field label="희망 라인" htmlFor="line" required>
                    <select
                      id="line"
                      name="line"
                      value={line}
                      onChange={(e) => {
                        setLine(e.target.value);
                        setUnit1("");
                        setUnit2("");
                      }}
                      className={inputCls}
                    >
                      <option value="">선택하세요</option>
                      <option value="A라인 (동향)">A라인 (동향)</option>
                      <option value="B라인 (남향)">B라인 (남향)</option>
                      <option value="C라인 (서향)">C라인 (서향)</option>
                    </select>
                  </Field>

                  <Field
                    label="1순위 주택형"
                    htmlFor="unit1"
                    required
                    hint={line ? undefined : "라인을 먼저 선택하세요."}
                  >
                    <select
                      id="unit1"
                      name="unit1"
                      value={unit1}
                      disabled={!line}
                      onChange={(e) => setUnit1(e.target.value as UnitKey)}
                      className={inputCls}
                    >
                      <option value="">선택하세요</option>
                      {(Object.keys(UNITS) as UnitKey[]).map((k) => (
                        <option key={k} value={k}>
                          {k} · {UNITS[k].area} · {UNITS[k].total}세대
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="2순위 주택형" htmlFor="unit2" hint="선택 사항입니다.">
                    <select
                      id="unit2"
                      name="unit2"
                      value={unit2}
                      disabled={!unit1}
                      onChange={(e) => setUnit2(e.target.value as UnitKey)}
                      className={inputCls}
                    >
                      <option value="">신청하지 않음</option>
                      {(Object.keys(UNITS) as UnitKey[])
                        .filter((k) => k !== unit1)
                        .map((k) => (
                          <option key={k} value={k}>
                            {k} · {UNITS[k].area}
                          </option>
                        ))}
                    </select>
                  </Field>

                  <Field label="희망 층" htmlFor="floor" required>
                    <select
                      id="floor"
                      name="floor"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">선택하세요</option>
                      {Object.keys(FLOOR_ADJUST).map((f) => (
                        <option key={f} value={f}>
                          {f} · 임대료 {FLOOR_ADJUST[f] > 0 ? "+" : ""}
                          {Math.round(FLOOR_ADJUST[f] * 100)}%
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="보증금 전환 희망" htmlFor="convert">
                    <select
                      id="convert"
                      name="convert"
                      value={convert}
                      onChange={(e) => setConvert(e.target.value)}
                      className={inputCls}
                    >
                      <option>전환하지 않음</option>
                      <option>보증금 50% 증액 (월세 감액)</option>
                      <option>보증금 100% 증액 (월세 감액)</option>
                      <option>보증금 최대 전환 (표준의 200%)</option>
                    </select>
                  </Field>

                  {unit1 && floor && (
                    <div className="rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-[13px]">
                      <p className="font-semibold text-neutral-900">예상 임대조건</p>
                      <dl className="mt-2 grid gap-1 text-neutral-700">
                        <div className="flex justify-between">
                          <dt>임대보증금</dt>
                          <dd className="font-medium tabular-nums">
                            {won(UNITS[unit1].deposit)}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>월임대료 ({floor} 가산 반영)</dt>
                          <dd className="font-medium tabular-nums">{won(rent1)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>계약금 (보증금의 10%)</dt>
                          <dd className="font-medium tabular-nums">
                            {won(Math.round(UNITS[unit1].deposit * 0.1))}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-2 text-xs text-neutral-500">
                        ※ 실제 임대료는 동·호수 확정 후 층·향 가산을 적용해 계약 시
                        확정됩니다.
                      </p>
                    </div>
                  )}
                </Fieldset>
              )}

              {step === 3 && (
                <Fieldset
                  legend="4. 소득·자산 및 가점"
                  desc="입력값은 사회보장정보시스템으로 사후 검증됩니다."
                >
                  <Field
                    label="가구원 수"
                    htmlFor="household"
                    required
                    hint="본인을 포함한 주민등록표 등본상 세대원 수입니다."
                  >
                    <select
                      id="household"
                      name="household"
                      value={household}
                      onChange={(e) => {
                        setHousehold(e.target.value);
                        setMembers([]);
                      }}
                      className={inputCls}
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n}인
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="월평균소득 (원)"
                    htmlFor="income"
                    required
                    hint={
                      type
                        ? `${type} 유형 ${household}인 가구 기준 상한 ${won(limit)}`
                        : "유형을 먼저 선택하세요."
                    }
                  >
                    <input
                      id="income"
                      name="income"
                      inputMode="numeric"
                      value={income}
                      onChange={(e) => setIncome(e.target.value)}
                      className={inputCls}
                      placeholder="3200000"
                    />
                    {incomeOver && (
                      <p className="text-xs font-medium text-red-600">
                        기준을 {won(incomeNum - limit)} 초과합니다. 이 유형으로는 신청할
                        수 없습니다.
                      </p>
                    )}
                    {!incomeOver && incomeNum > 0 && (
                      <p className="text-xs text-emerald-700">
                        기준 대비 {Math.round((incomeNum / base) * 100)}% · 적격
                      </p>
                    )}
                  </Field>

                  <Field
                    label="총자산 (원)"
                    htmlFor="assets"
                    required
                    hint={
                      type
                        ? `${type} 유형 상한 ${won(ASSET_CAP[type])} · 부채는 차감 후 금액`
                        : undefined
                    }
                  >
                    <input
                      id="assets"
                      name="assets"
                      inputMode="numeric"
                      value={assets}
                      onChange={(e) => setAssets(e.target.value)}
                      className={inputCls}
                      placeholder="41000000"
                    />
                    {assetOver && (
                      <p className="text-xs font-medium text-red-600">
                        자산 기준을 초과합니다.
                      </p>
                    )}
                  </Field>

                  <Field label="자동차 소유 여부" htmlFor="hasCar" required>
                    <select
                      id="hasCar"
                      name="hasCar"
                      value={hasCar}
                      onChange={(e) => setHasCar(e.target.value)}
                      className={inputCls}
                    >
                      <option value="아니오">아니오</option>
                      <option value="예">예</option>
                    </select>
                  </Field>

                  {hasCar === "예" && (
                    <Field
                      label="자동차가액 (원)"
                      htmlFor="carValue"
                      required
                      hint="보험개발원 차량기준가액 기준. 3,803만원을 초과하면 신청할 수 없습니다."
                    >
                      <input
                        id="carValue"
                        name="carValue"
                        inputMode="numeric"
                        value={carValue}
                        onChange={(e) => setCarValue(e.target.value)}
                        className={inputCls}
                        placeholder="12000000"
                      />
                      {carOver && (
                        <p className="text-xs font-medium text-red-600">
                          자동차가액 기준을 초과합니다.
                        </p>
                      )}
                    </Field>
                  )}

                  {Number(household) > 1 && (
                    <Field
                      label={`세대원 (본인 제외 ${Number(household) - 1}명)`}
                      required
                      hint="가구원 수와 등록한 세대원 수가 일치해야 다음 단계로 넘어갑니다."
                    >
                      <RepeatRows<Member>
                        rows={members}
                        setRows={setMembers}
                        blank={() => ({ relation: "", name: "", birth: "", house: "" })}
                        columns={["관계", "성명", "생년월일", "주택 소유"]}
                        max={Number(household) - 1}
                        addLabel="세대원 추가"
                        render={(row, i, update) => (
                          <>
                            <Cell>
                              <select
                                name={`member-relation-${i}`}
                                value={row.relation}
                                onChange={(e) => update({ relation: e.target.value })}
                                className={cellInputCls}
                              >
                                <option value="">선택</option>
                                <option>배우자</option>
                                <option>자녀</option>
                                <option>부</option>
                                <option>모</option>
                                <option>형제자매</option>
                              </select>
                            </Cell>
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
                                name={`member-birth-${i}`}
                                type="date"
                                value={row.birth}
                                onChange={(e) => update({ birth: e.target.value })}
                                className={cellInputCls}
                              />
                            </Cell>
                            <Cell>
                              <select
                                name={`member-house-${i}`}
                                value={row.house}
                                onChange={(e) => update({ house: e.target.value })}
                                className={cellInputCls}
                              >
                                <option value="">선택</option>
                                <option>무주택</option>
                                <option>유주택</option>
                              </select>
                            </Cell>
                          </>
                        )}
                      />
                    </Field>
                  )}

                  <Field label="포항시 거주기간" htmlFor="residence" required>
                    <select
                      id="residence"
                      name="residence"
                      value={residence}
                      onChange={(e) => setResidence(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">선택하세요</option>
                      <option>1년 미만</option>
                      <option>1년 이상 3년 미만</option>
                      <option>3년 이상</option>
                    </select>
                  </Field>

                  <Field label="무주택 기간" htmlFor="homeless" required>
                    <select
                      id="homeless"
                      name="homeless"
                      value={homeless}
                      onChange={(e) => setHomeless(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">선택하세요</option>
                      <option>1년 미만</option>
                      <option>1년 이상 3년 미만</option>
                      <option>3년 이상</option>
                    </select>
                  </Field>

                  <div
                    className={`${site.accentSoft} rounded px-4 py-3 text-[13px] text-neutral-800`}
                  >
                    <p className="flex items-center justify-between font-semibold">
                      <span>현재 가점 합계</span>
                      <span className="text-lg tabular-nums">{points} / 10점</span>
                    </p>
                    <p className="mt-1 text-xs text-neutral-600">
                      거주기간·무주택기간·자녀수·사회초년생 항목의 합계입니다. 상한은
                      10점이며 서류제출 단계에서 증빙으로 확정합니다.
                    </p>
                  </div>
                </Fieldset>
              )}

              {step === 4 && (
                <Fieldset
                  legend="5. 서류 제출 및 확인"
                  desc="접수 단계에서는 청약신청서만 제출합니다. 나머지 증빙은 서류제출대상자 발표 후 제출합니다."
                >
                  <Field
                    label="청약신청서 (지정서식 HWP)"
                    required
                    hint={
                      <>
                        공고 상세의 붙임2 지정서식을 내려받아 작성한 뒤 올리세요. 파일명은{" "}
                        <strong className="font-mono">{expectedFileName}</strong>{" "}
                        형식이어야 합니다.
                      </>
                    }
                  >
                    <FileDrop
                      name="applicationForm"
                      accept=".hwp,.hwpx"
                      maxMB={10}
                      label="작성한 청약신청서를 올려주세요"
                      onChange={setFormFile}
                      validateName={(fileName) => {
                        if (!/^청약신청서_/.test(fileName)) {
                          return "파일명이 「청약신청서_」로 시작해야 합니다.";
                        }
                        if (name && !fileName.includes(name)) {
                          return `파일명에 신청자 성명(${name})이 들어가야 합니다.`;
                        }
                        if (unit1 && !fileName.includes(unit1)) {
                          return `파일명에 1순위 주택형(${unit1})이 들어가야 합니다.`;
                        }
                        return null;
                      }}
                    />
                  </Field>

                  <Callout tone="warn">
                    자유양식으로 작성한 신청서는 검토 없이 반려됩니다. 지정서식은 공고
                    상세 화면의 첨부파일에서만 내려받을 수 있습니다.
                  </Callout>

                  <Field label="동의" required>
                    <div className="grid gap-2">
                      {[
                        "개인정보 수집·이용 및 소득·자산 조회에 동의합니다. (필수)",
                        "기재 사항이 사실과 다를 경우 당첨 취소 및 2년간 청약 제한에 동의합니다. (필수)",
                      ].map((t) => (
                        <label
                          key={t}
                          className="flex items-start gap-2 text-[13px] text-neutral-700"
                        >
                          <input
                            type="checkbox"
                            name="agree"
                            checked={agree.includes(t)}
                            onChange={() => toggleAgree(t)}
                            className="mt-0.5"
                          />
                          <span>{t}</span>
                        </label>
                      ))}
                    </div>
                  </Field>

                  <div className="rounded border border-neutral-200 px-4 py-3 text-[13px]">
                    <p className="font-semibold text-neutral-900">최종 확인</p>
                    <dl className="mt-2 grid gap-1 text-neutral-700">
                      {[
                        ["신청자", name],
                        ["유형", special ? `${type} (특별공급 포함)` : type],
                        ["희망 주택형", [unit1, unit2].filter(Boolean).join(" · ")],
                        ["월평균소득", income ? won(incomeNum) : "—"],
                        ["가점 합계", `${points}점`],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4">
                          <dt className="text-neutral-500">{k}</dt>
                          <dd className="text-right font-medium">{v || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
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
                    청약 신청서 제출
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </main>
      <DemoFooter site={site} />
    </>
  );
}
