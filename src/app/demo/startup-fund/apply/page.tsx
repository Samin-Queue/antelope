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
  Steps,
  Submitted,
  type PickedFile,
} from "../../_lib/fields";
import { getSite } from "../../_lib/sites";

const site = getSite("startup-fund");

const STEPS = ["자격 자가진단", "기업 정보", "사업 계획", "서류 제출"];

/**
 * 신청 방식 1 — 다단계 위저드.
 *
 * 한 화면에 전부 보이지 않는다. 앞 단계를 통과해야 다음이 열리고, 자가진단에서
 * 결격이면 아예 진행이 막힌다. 지정양식을 내려받아 다시 올리는 왕복도 포함한다.
 */
export default function StartupFundApply() {
  const [step, setStep] = React.useState(0);
  const [receipt, setReceipt] = React.useState<string | null>(null);

  // 1단계 — 자가진단
  const [founded, setFounded] = React.useState("");
  const [track, setTrack] = React.useState("");
  const [disq, setDisq] = React.useState<string[]>([]);

  // 2단계 — 기업 정보
  const [company, setCompany] = React.useState("");
  const [bizNo, setBizNo] = React.useState("");
  const [ceo, setCeo] = React.useState("");
  const [birth, setBirth] = React.useState("");
  const [headcount, setHeadcount] = React.useState("");
  const [addr, setAddr] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");

  // 3단계 — 사업 계획
  const [itemName, setItemName] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [total, setTotal] = React.useState("");
  const [ask, setAsk] = React.useState("");
  const [bonus, setBonus] = React.useState<string[]>([]);

  // 4단계 — 서류
  const [plan, setPlan] = React.useState<PickedFile[]>([]);
  const [certs, setCerts] = React.useState<PickedFile[]>([]);
  const [agreed, setAgreed] = React.useState(false);
  const [formDownloaded, setFormDownloaded] = React.useState(false);

  const disqualified = disq.length > 0;
  const withinThreeYears = founded !== "" && founded >= "2023-08-25";

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const step1Ok = founded !== "" && track !== "" && withinThreeYears && !disqualified;
  const step2Ok = company && bizNo && ceo && addr && email && phone;
  const step3Ok = itemName && summary.length >= 100 && total && ask;
  const step4Ok = plan.length > 0 && certs.length >= 3 && agreed;

  const okByStep = [step1Ok, step2Ok, step3Ok, step4Ok];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step4Ok) return;
    setReceipt(receiptNo("NSA"));
    window.scrollTo({ top: 0 });
  }

  function reset() {
    setReceipt(null);
    setStep(0);
  }

  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "사업안내" },
          { label: "모집공고" },
          { label: "온라인신청", active: true },
        ]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <Link
          href={`/demo/${site.slug}`}
          className="text-[13px] text-neutral-500 underline underline-offset-4"
        >
          ← 공고문으로
        </Link>
        <h1 className="mt-3 mb-8 text-xl font-bold">{site.title} · 온라인 신청</h1>

        {receipt ? (
          <Submitted
            accent={site.accent}
            receipt={receipt}
            summary={[
              { label: "기업명", value: company },
              { label: "대표자", value: ceo },
              { label: "신청 트랙", value: track },
              {
                label: "신청금액",
                value: ask ? `${Number(ask).toLocaleString()} 천원` : "",
              },
              { label: "제출 서류", value: `${plan.length + certs.length}건` },
            ]}
            onReset={reset}
          />
        ) : (
          <form onSubmit={submit} className="grid gap-8">
            <Steps steps={STEPS} current={step} accent={site.accent} />

            {step === 0 && (
              <Fieldset
                legend="자격 자가진단"
                desc="아래 항목을 먼저 확인해야 신청서가 열립니다."
              >
                <Field
                  label="법인 설립일 (개인사업자는 사업자등록일)"
                  htmlFor="founded"
                  required
                  hint="공고일 기준 창업 3년 이내 — 2023.08.25 이후"
                >
                  <input
                    id="founded"
                    name="founded"
                    type="date"
                    value={founded}
                    onChange={(e) => setFounded(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                {founded !== "" && !withinThreeYears && (
                  <Callout tone="warn">
                    창업 3년을 초과하여 본 사업에 신청할 수 없습니다. 후속 단계로 진행되지
                    않습니다.
                  </Callout>
                )}

                <Field label="신청 트랙" required>
                  <div className="grid gap-2">
                    {[
                      ["일반트랙", "지원한도 70,000천원 · 기업부담 30% 이상"],
                      ["청년트랙", "대표자 만 39세 이하 · 지원한도 100,000천원"],
                      ["재도전트랙", "폐업 후 재창업 · 지원한도 50,000천원"],
                    ].map(([value, desc]) => (
                      <label
                        key={value}
                        className="flex cursor-pointer items-start gap-3 rounded border border-neutral-300 px-3 py-2.5 has-checked:border-neutral-900 has-checked:bg-neutral-50"
                      >
                        <input
                          type="radio"
                          name="track"
                          value={value}
                          checked={track === value}
                          onChange={() => setTrack(value)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-[13px] font-medium">{value}</span>
                          <span className="block text-xs text-neutral-500">{desc}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>

                <Field
                  label="결격사유 확인"
                  hint="해당하는 항목이 하나라도 있으면 신청할 수 없습니다."
                >
                  <div className="grid gap-1.5">
                    {[
                      "휴업 또는 폐업 중이다",
                      "국세 또는 지방세를 체납 중이다",
                      "최근 3년 이내 본 기관 지원사업 협약이 해지된 이력이 있다",
                      "대표자가 금융기관 채무불이행자로 등록되어 있다",
                    ].map((label) => (
                      <label key={label} className="flex items-start gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          name="disqualification"
                          value={label}
                          checked={disq.includes(label)}
                          onChange={() => toggle(disq, setDisq, label)}
                          className="mt-0.5"
                        />
                        <span className="text-neutral-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </Field>

                {disqualified && (
                  <Callout tone="warn">
                    결격사유에 해당하여 신청이 제한됩니다. 사실과 다르다면 체크를
                    해제하세요.
                  </Callout>
                )}
              </Fieldset>
            )}

            {step === 1 && (
              <Fieldset legend="기업 정보">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="기업명" htmlFor="company" required>
                    <input
                      id="company"
                      name="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className={inputCls}
                      placeholder="(주)"
                    />
                  </Field>
                  <Field label="사업자등록번호" htmlFor="bizNo" required>
                    <input
                      id="bizNo"
                      name="bizNo"
                      value={bizNo}
                      onChange={(e) => setBizNo(e.target.value)}
                      className={inputCls}
                      placeholder="000-00-00000"
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="대표자 성명" htmlFor="ceo" required>
                    <input
                      id="ceo"
                      name="ceo"
                      value={ceo}
                      onChange={(e) => setCeo(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field
                    label="대표자 생년월일"
                    htmlFor="birth"
                    hint={
                      track === "청년트랙"
                        ? "청년트랙은 만 39세 이하만 신청 가능"
                        : undefined
                    }
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
                  <Field label="상시근로자 수" htmlFor="headcount">
                    <input
                      id="headcount"
                      name="headcount"
                      type="number"
                      min={0}
                      value={headcount}
                      onChange={(e) => setHeadcount(e.target.value)}
                      className={inputCls}
                      placeholder="대표자 제외"
                    />
                  </Field>
                  <Field label="담당자 연락처" htmlFor="phone" required>
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
                <Field label="사업장 소재지" htmlFor="addr" required>
                  <input
                    id="addr"
                    name="addr"
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                    className={inputCls}
                    placeholder="경상북도 포항시 ..."
                  />
                </Field>
                <Field label="담당자 이메일" htmlFor="email" required>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </Fieldset>
            )}

            {step === 2 && (
              <Fieldset legend="사업 계획">
                <Field label="사업 아이템명" htmlFor="itemName" required>
                  <input
                    id="itemName"
                    name="itemName"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field
                  label="사업 개요"
                  htmlFor="summary"
                  required
                  hint={`${summary.length} / 최소 100자, 최대 1000자`}
                >
                  <textarea
                    id="summary"
                    name="summary"
                    rows={7}
                    maxLength={1000}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className={inputCls}
                    placeholder="해결하려는 문제와 접근 방법을 서술하세요."
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="총사업비 (천원)" htmlFor="total" required>
                    <input
                      id="total"
                      name="total"
                      type="number"
                      min={0}
                      value={total}
                      onChange={(e) => setTotal(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field
                    label="정부지원금 신청액 (천원)"
                    htmlFor="ask"
                    required
                    hint={
                      total && ask && Number(ask) > Number(total) * 0.8
                        ? "기업 부담률이 20% 미만입니다. 공고 3항을 확인하세요."
                        : undefined
                    }
                  >
                    <input
                      id="ask"
                      name="ask"
                      type="number"
                      min={0}
                      value={ask}
                      onChange={(e) => setAsk(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="가점 항목 (해당 시 증빙 필요)">
                  <div className="grid gap-1.5">
                    {[
                      "여성기업 확인서 보유 (2점)",
                      "지식재산권 등록 보유 (2점)",
                      "최근 1년 이내 정부 창업경진대회 수상 (3점)",
                    ].map((label) => (
                      <label key={label} className="flex items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          name="bonus"
                          value={label}
                          checked={bonus.includes(label)}
                          onChange={() => toggle(bonus, setBonus, label)}
                        />
                        <span className="text-neutral-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </Field>
              </Fieldset>
            )}

            {step === 3 && (
              <Fieldset legend="서류 제출">
                <Callout>
                  <p className="font-semibold">붙임1. 사업계획서 지정양식</p>
                  <p className="mt-1 text-neutral-600">
                    자유양식으로 제출한 경우 검토 없이 반려됩니다. 양식을 내려받아 작성한
                    뒤 PDF 로 변환해 업로드하세요.
                  </p>
                  <a
                    href="data:text/plain;charset=utf-8,%EB%B6%99%EC%9E%841_%EC%82%AC%EC%97%85%EA%B3%84%ED%9A%8D%EC%84%9C_%EC%A7%80%EC%A0%95%EC%96%91%EC%8B%9D"
                    download="붙임1_사업계획서_지정양식.hwp"
                    onClick={() => setFormDownloaded(true)}
                    className="mt-3 inline-block rounded border border-neutral-400 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                  >
                    지정양식 내려받기 (.hwp)
                    {formDownloaded && <span className="ml-2 text-green-700">✓</span>}
                  </a>
                </Callout>

                <Field
                  label="사업계획서"
                  required
                  hint="파일명은 「사업계획서_기업명」 형식으로 합니다."
                >
                  <FileDrop
                    name="planFile"
                    accept=".pdf"
                    maxMB={20}
                    onChange={setPlan}
                    label="작성한 사업계획서를 PDF 로 변환해 올려주세요"
                  />
                </Field>

                <Field
                  label="증빙 서류"
                  required
                  hint="사업자등록증명원 · 대표자 신분증 사본 · 국세/지방세 완납증명서 (3건 이상)"
                >
                  <FileDrop
                    name="certFiles"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    maxMB={10}
                    onChange={setCerts}
                    label="증빙 서류를 한꺼번에 올릴 수 있습니다"
                  />
                </Field>

                <label className="flex items-start gap-2 rounded border border-neutral-300 bg-neutral-50 px-4 py-3 text-[13px]">
                  <input
                    type="checkbox"
                    name="agree"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-neutral-700">
                    기재 내용이 사실과 다를 경우 선정 취소 및 지원금 환수 조치될 수 있음을
                    확인했으며, 개인정보 수집·이용에 동의합니다.{" "}
                    <span className="text-red-600">*</span>
                  </span>
                </label>
              </Fieldset>
            )}

            <div className="flex items-center justify-between border-t border-neutral-200 pt-5">
              <button
                type="button"
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
                className="rounded border border-neutral-300 px-4 py-2 text-[13px] font-medium text-neutral-700 disabled:opacity-40"
              >
                이전
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  disabled={!okByStep[step]}
                  onClick={() => setStep((s) => s + 1)}
                  className={`${site.accent} rounded px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40`}
                >
                  다음 단계
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!step4Ok}
                  className={`${site.accent} rounded px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40`}
                >
                  최종 제출
                </button>
              )}
            </div>
          </form>
        )}
      </main>
      <DemoFooter site={site} />
    </>
  );
}
