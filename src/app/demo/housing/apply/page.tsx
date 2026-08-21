"use client";

import Link from "next/link";
import * as React from "react";

import { DemoFooter, DemoHeader } from "../../_lib/chrome";
import {
  Callout,
  Cell,
  cellInputCls,
  Field,
  Fieldset,
  inputCls,
  receiptNo,
  RepeatRows,
  Submitted,
} from "../../_lib/fields";
import { getSite } from "../../_lib/sites";

const site = getSite("housing");

type Member = { name: string; relation: string; birth: string; owns: string };

const TIERS = [
  { value: "청년", income: "120%", asset: "2억 7천만원" },
  { value: "신혼부부", income: "130% (맞벌이 140%)", asset: "3억 4천만원" },
  { value: "고령자", income: "100%", asset: "3억 4천만원" },
  { value: "주거급여수급자", income: "별도 적용", asset: "별도 적용" },
];

/**
 * 신청 방식 3 — 입력할수록 결과가 바뀌는 폼.
 *
 * 가점이 실시간으로 계산되어 화면에 남아 있고, 계층 선택에 따라 뒤따르는 질문이
 * 달라진다. 자동차 가액 같은 배제 조건은 입력 즉시 신청을 막는다. 값을 채워
 * 넣는 것만으로는 통과할 수 없고 조건 사이의 관계를 이해해야 한다.
 */
export default function HousingApply() {
  const [receipt, setReceipt] = React.useState<string | null>(null);

  const [tier, setTier] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [name, setName] = React.useState("");
  const [birth, setBirth] = React.useState("");
  const [phone, setPhone] = React.useState("");

  // 계층별 조건부 질문
  const [married, setMarried] = React.useState("");
  const [marriedOn, setMarriedOn] = React.useState("");
  const [jobSeeker, setJobSeeker] = React.useState(false);

  // 가점 재료
  const [residence, setResidence] = React.useState("");
  const [homeless, setHomeless] = React.useState("");
  const [deposits, setDeposits] = React.useState("");

  // 소득·자산
  const [income, setIncome] = React.useState("");
  const [assets, setAssets] = React.useState("");
  const [carValue, setCarValue] = React.useState("");

  const [members, setMembers] = React.useState<Member[]>([]);
  const [agreed, setAgreed] = React.useState(false);

  const carBlocked = carValue !== "" && Number(carValue) > 38030000;
  const dependents = members.filter((m) => m.relation !== "본인").length;

  const score =
    (residence === "3년 이상" ? 3 : residence === "1~3년" ? 2 : residence ? 1 : 0) +
    (homeless === "3년 이상" ? 3 : homeless === "1~3년" ? 2 : homeless ? 1 : 0) +
    (deposits === "24회 이상" ? 2 : deposits === "6~23회" ? 1 : 0) +
    Math.min(2, dependents) +
    (jobSeeker ? 2 : 0);
  const capped = Math.min(12, score);

  const anyOwner = members.some((m) => m.owns === "유");
  const ok =
    tier &&
    unit &&
    name &&
    birth &&
    phone &&
    income &&
    assets &&
    !carBlocked &&
    !anyOwner &&
    agreed;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setReceipt(receiptNo("HB"));
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "분양·임대" },
          { label: "청약신청", active: true },
          { label: "고객지원" },
        ]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <Link
          href={`/demo/${site.slug}`}
          className="text-[13px] text-neutral-500 underline underline-offset-4"
        >
          ← 공고문으로
        </Link>
        <h1 className="mt-3 mb-8 text-xl font-bold">포항 장량 행복주택 청약 신청</h1>

        {receipt ? (
          <Submitted
            accent={site.accent}
            receipt={receipt}
            summary={[
              { label: "신청자", value: name },
              { label: "공급 계층", value: tier },
              { label: "주택형", value: unit },
              { label: "가점 합계", value: `${capped}점` },
              { label: "세대원", value: `${members.length}명` },
            ]}
            onReset={() => setReceipt(null)}
          />
        ) : (
          <form onSubmit={submit} className="grid gap-8">
            {/* 실시간 가점판 — 입력하는 내내 눈에 남아 있다 */}
            <div
              className={`${site.accentSoft} sticky top-0 z-10 -mx-5 flex items-center justify-between border-b border-neutral-200 px-5 py-3`}
            >
              <div>
                <p className="text-xs text-neutral-500">현재 가점 합계</p>
                <p className={`text-xl font-bold ${site.accentText}`}>
                  {capped}
                  <span className="ml-1 text-sm font-normal text-neutral-500">
                    / 12점
                  </span>
                </p>
              </div>
              <ul className="text-right text-[11px] leading-relaxed text-neutral-600">
                <li>거주기간 {residence || "미입력"}</li>
                <li>무주택 {homeless || "미입력"}</li>
                <li>부양가족 {Math.min(2, dependents)}점</li>
              </ul>
            </div>

            <Fieldset legend="공급 계층 선택" desc="계층에 따라 이후 질문이 달라집니다.">
              <Field label="신청 계층" required>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TIERS.map((t) => (
                    <label
                      key={t.value}
                      className="flex cursor-pointer items-start gap-2.5 rounded border border-neutral-300 px-3 py-2.5 has-checked:border-neutral-900 has-checked:bg-neutral-50"
                    >
                      <input
                        type="radio"
                        name="tier"
                        value={t.value}
                        checked={tier === t.value}
                        onChange={() => setTier(t.value)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-[13px] font-medium">{t.value}</span>
                        <span className="block text-xs text-neutral-500">
                          소득 {t.income} · 자산 {t.asset}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>

              {tier === "신혼부부" && (
                <div className="grid gap-5 rounded border border-neutral-200 bg-neutral-50 p-4">
                  <Field label="혼인 상태" required>
                    <select
                      id="married"
                      name="married"
                      value={married}
                      onChange={(e) => setMarried(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">선택하세요</option>
                      <option>혼인 중</option>
                      <option>예비신혼부부 (입주 전 혼인 예정)</option>
                    </select>
                  </Field>
                  {married === "혼인 중" && (
                    <Field
                      label="혼인신고일"
                      htmlFor="marriedOn"
                      required
                      hint="혼인 7년 이내여야 합니다."
                    >
                      <input
                        id="marriedOn"
                        name="marriedOn"
                        type="date"
                        value={marriedOn}
                        onChange={(e) => setMarriedOn(e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                  )}
                </div>
              )}

              {tier === "청년" && (
                <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
                  <label className="flex items-start gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      name="jobSeeker"
                      checked={jobSeeker}
                      onChange={(e) => setJobSeeker(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-neutral-700">
                      사회초년생 또는 취업준비생에 해당합니다 <strong>(가점 2점)</strong>
                    </span>
                  </label>
                </div>
              )}

              <Field label="신청 주택형" required>
                <select
                  id="unit"
                  name="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className={inputCls}
                >
                  <option value="">선택하세요</option>
                  <option>16㎡ — 보증금 9,800,000원 / 월 78,000원</option>
                  <option>26㎡ — 보증금 16,400,000원 / 월 131,000원</option>
                  <option>36㎡ — 보증금 24,900,000원 / 월 198,000원</option>
                </select>
              </Field>
            </Fieldset>

            <Fieldset legend="신청자 정보">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="성명" htmlFor="name" required>
                  <input
                    id="name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
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
                <Field label="연락처" htmlFor="phone" required>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputCls}
                    placeholder="010-0000-0000"
                  />
                </Field>
              </div>
            </Fieldset>

            <Fieldset legend="가점 항목">
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="해당 지역 거주기간" htmlFor="residence">
                  <select
                    id="residence"
                    name="residence"
                    value={residence}
                    onChange={(e) => setResidence(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">선택</option>
                    <option>1년 미만</option>
                    <option>1~3년</option>
                    <option>3년 이상</option>
                  </select>
                </Field>
                <Field label="무주택 기간" htmlFor="homeless">
                  <select
                    id="homeless"
                    name="homeless"
                    value={homeless}
                    onChange={(e) => setHomeless(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">선택</option>
                    <option>1년 미만</option>
                    <option>1~3년</option>
                    <option>3년 이상</option>
                  </select>
                </Field>
                <Field label="청약저축 납입 횟수" htmlFor="deposits">
                  <select
                    id="deposits"
                    name="deposits"
                    value={deposits}
                    onChange={(e) => setDeposits(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">선택</option>
                    <option>6회 미만</option>
                    <option>6~23회</option>
                    <option>24회 이상</option>
                  </select>
                </Field>
              </div>
              {score > 12 && (
                <Callout>
                  산출 가점은 {score}점이나 상한 규정에 따라 <strong>12점</strong>으로
                  반영됩니다.
                </Callout>
              )}
            </Fieldset>

            <Fieldset
              legend="세대구성원"
              desc="주민등록표등본 기준으로 본인을 포함해 모두 입력합니다. 부양가족 1명당 1점(최대 2점)."
            >
              <RepeatRows<Member>
                rows={members}
                setRows={setMembers}
                blank={() => ({ name: "", relation: "본인", birth: "", owns: "무" })}
                columns={["성명", "관계", "생년월일", "주택소유"]}
                addLabel="+ 세대원 추가"
                max={8}
                render={(row, i, update) => (
                  <>
                    <Cell>
                      <input
                        name={`member-${i}-name`}
                        value={row.name}
                        onChange={(e) => update({ name: e.target.value })}
                        className={cellInputCls}
                      />
                    </Cell>
                    <Cell>
                      <select
                        name={`member-${i}-relation`}
                        value={row.relation}
                        onChange={(e) => update({ relation: e.target.value })}
                        className={cellInputCls}
                      >
                        <option>본인</option>
                        <option>배우자</option>
                        <option>자녀</option>
                        <option>부모</option>
                        <option>형제자매</option>
                      </select>
                    </Cell>
                    <Cell>
                      <input
                        name={`member-${i}-birth`}
                        type="date"
                        value={row.birth}
                        onChange={(e) => update({ birth: e.target.value })}
                        className={cellInputCls}
                      />
                    </Cell>
                    <Cell>
                      <select
                        name={`member-${i}-owns`}
                        value={row.owns}
                        onChange={(e) => update({ owns: e.target.value })}
                        className={cellInputCls}
                      >
                        <option>무</option>
                        <option>유</option>
                      </select>
                    </Cell>
                  </>
                )}
              />
              {anyOwner && (
                <Callout tone="warn">
                  세대구성원 중 주택 소유자가 있어 신청할 수 없습니다. 분양권·입주권도
                  주택 소유로 봅니다.
                </Callout>
              )}
            </Fieldset>

            <Fieldset
              legend="소득 및 자산"
              desc="사회보장정보시스템을 통해 사후 검증됩니다."
            >
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="세대 월평균소득 (원)" htmlFor="income" required>
                  <input
                    id="income"
                    name="income"
                    type="number"
                    min={0}
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="총자산 (원)" htmlFor="assets" required>
                  <input
                    id="assets"
                    name="assets"
                    type="number"
                    min={0}
                    value={assets}
                    onChange={(e) => setAssets(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field
                  label="자동차 가액 (원)"
                  htmlFor="carValue"
                  hint="3,803만원 초과 시 신청 불가"
                >
                  <input
                    id="carValue"
                    name="carValue"
                    type="number"
                    min={0}
                    value={carValue}
                    onChange={(e) => setCarValue(e.target.value)}
                    className={inputCls}
                    placeholder="미보유 시 0"
                  />
                </Field>
              </div>
              {carBlocked && (
                <Callout tone="warn">
                  자동차 가액이 기준(38,030,000원)을 초과하여 계층과 무관하게 신청할 수
                  없습니다.
                </Callout>
              )}

              <label className="flex items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  name="agree"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-neutral-700">
                  기재 사항이 사실과 다를 경우 당첨이 취소되고 2년간 청약이 제한됨을
                  확인했습니다. <span className="text-red-600">*</span>
                </span>
              </label>
            </Fieldset>

            <div className="flex justify-end border-t border-neutral-200 pt-5">
              <button
                type="submit"
                disabled={!ok}
                className={`${site.accent} rounded px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40`}
              >
                청약 신청
              </button>
            </div>
          </form>
        )}
      </main>
      <DemoFooter site={site} />
    </>
  );
}
