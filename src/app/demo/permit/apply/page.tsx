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

const site = getSite("permit");

const STEPS = ["신고 정보", "지정서식 제출", "전자서명", "수수료 납부"];

/** 지정서식 3종. 각각 다운로드해서 작성한 뒤 HWP 그대로 올려야 한다. */
const FORMS = [
  {
    id: "form1",
    no: "서식1",
    title: "영업신고서",
    pattern: (shop: string) => `[서식1]영업신고서_${shop || "상호명"}.hwp`,
    re: /^\[서식1\]영업신고서_\S+\.(hwp|hwpx)$/i,
  },
  {
    id: "form2",
    no: "서식2",
    title: "위생교육 이수증명서",
    pattern: (_shop: string, ceo: string) =>
      `[서식2]위생교육이수증_${ceo || "대표자명"}.hwp`,
    re: /^\[서식2\]위생교육이수증_\S+\.(hwp|hwpx)$/i,
  },
  {
    id: "form3",
    no: "서식3",
    title: "영업장 시설 배치도",
    pattern: (shop: string) => `[서식3]시설배치도_${shop || "상호명"}.hwp`,
    re: /^\[서식3\]시설배치도_\S+\.(hwp|hwpx)$/i,
  },
] as const;

/** 한글 문서를 흉내낸 더미 — 실제 HWP 바이너리가 아니라 다운로드 동작만 재현한다 */
function formHref(title: string) {
  return `data:application/x-hwp;charset=utf-8,${encodeURIComponent(
    `[온빛시청 위생민원과 지정서식] ${title}\n\n※ 이 파일은 데모용 더미입니다.`,
  )}`;
}

/**
 * 신청 방식 6 — 지정서식 왕복과 파일명 규칙.
 *
 * PDF 를 올리면 거부한다. 서식마다 슬롯이 따로 있고, 파일명이 규칙에 맞지
 * 않으면 업로드 자체가 막힌다. 전자서명과 수수료 납부가 모두 끝나야 접수가
 * 확정되는 관공서 민원 흐름을 그대로 재현한다.
 */
export default function PermitApply() {
  const [step, setStep] = React.useState(0);
  const [receipt, setReceipt] = React.useState<string | null>(null);

  const [shop, setShop] = React.useState("");
  const [ceo, setCeo] = React.useState("");
  const [bizNo, setBizNo] = React.useState("");
  const [addr, setAddr] = React.useState("");
  const [area, setArea] = React.useState("");
  const [openAt, setOpenAt] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [hygieneDate, setHygieneDate] = React.useState("");
  const [buildingUse, setBuildingUse] = React.useState("");

  const [downloaded, setDownloaded] = React.useState<string[]>([]);
  const [uploads, setUploads] = React.useState<Record<string, PickedFile[]>>({});
  const [health, setHealth] = React.useState<PickedFile[]>([]);
  const [lease, setLease] = React.useState<PickedFile[]>([]);

  const [certPassword, setCertPassword] = React.useState("");
  const [signing, setSigning] = React.useState(false);
  const [signedAt, setSignedAt] = React.useState<string | null>(null);

  const [payMethod, setPayMethod] = React.useState("");
  const [paying, setPaying] = React.useState(false);

  // 위생교육은 2년이 지나면 인정되지 않는다.
  // 렌더 중에 Date.now() 를 부르면 순수하지 않아, 날짜가 바뀔 때 계산해 둔다.
  const [hygieneStale, setHygieneStale] = React.useState(false);
  const useBlocked = buildingUse !== "" && buildingUse !== "근린생활시설";

  const allForms = FORMS.every((f) => (uploads[f.id]?.length ?? 0) > 0);

  const step1Ok =
    shop &&
    ceo &&
    bizNo &&
    addr &&
    area &&
    openAt &&
    phone &&
    hygieneDate &&
    buildingUse &&
    !hygieneStale &&
    !useBlocked;
  const step2Ok = allForms && health.length > 0;
  const step3Ok = signedAt !== null;
  const step4Ok = payMethod !== "";
  const okByStep = [step1Ok, step2Ok, step3Ok, step4Ok];

  function sign() {
    if (certPassword.length < 4) return;
    setSigning(true);
    window.setTimeout(() => {
      setSigning(false);
      setSignedAt(new Date().toLocaleString("ko-KR"));
    }, 1100);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step4Ok) return;
    setPaying(true);
    window.setTimeout(() => {
      setPaying(false);
      setReceipt(receiptNo("ONBIT"));
      window.scrollTo({ top: 0 });
    }, 1200);
  }

  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "민원안내" },
          { label: "온라인신청", active: true },
          { label: "처리현황" },
        ]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <Link
          href={`/demo/${site.slug}`}
          className="text-[13px] text-neutral-500 underline underline-offset-4"
        >
          ← 민원안내로
        </Link>
        <h1 className="mt-3 mb-8 text-xl font-bold">일반음식점 영업신고</h1>

        {receipt ? (
          <Submitted
            accent={site.accent}
            receipt={receipt}
            summary={[
              { label: "상호", value: shop },
              { label: "대표자", value: ceo },
              { label: "영업장", value: addr },
              { label: "전자서명", value: signedAt ?? "" },
              {
                label: "첨부",
                value: `지정서식 3종 · 보건증${lease.length > 0 ? " · 임대차계약서" : ""}`,
              },
              { label: "수수료", value: `28,000원 (${payMethod})` },
              { label: "처리기간", value: "3일 (토·공휴일 제외)" },
            ]}
            onReset={() => {
              setReceipt(null);
              setStep(0);
            }}
          />
        ) : (
          <form onSubmit={submit} className="grid gap-8">
            <Steps steps={STEPS} current={step} accent={site.accent} />

            {step === 0 && (
              <Fieldset legend="신고 정보">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="상호"
                    htmlFor="shop"
                    required
                    hint="서식 파일명에 사용됩니다"
                  >
                    <input
                      id="shop"
                      name="shop"
                      value={shop}
                      onChange={(e) => setShop(e.target.value)}
                      className={inputCls}
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
                  <Field label="연락처" htmlFor="phone" required>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="영업장 면적 (㎡)" htmlFor="area" required>
                    <input
                      id="area"
                      name="area"
                      type="number"
                      min={0}
                      step="0.01"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="영업 개시 예정일" htmlFor="openAt" required>
                    <input
                      id="openAt"
                      name="openAt"
                      type="date"
                      value={openAt}
                      onChange={(e) => setOpenAt(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>

                <Field label="영업장 소재지" htmlFor="addr" required>
                  <input
                    id="addr"
                    name="addr"
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                <Field
                  label="건축물대장상 용도"
                  htmlFor="buildingUse"
                  required
                  hint="근린생활시설이 아니면 용도변경이 선행되어야 합니다."
                >
                  <select
                    id="buildingUse"
                    name="buildingUse"
                    value={buildingUse}
                    onChange={(e) => setBuildingUse(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">선택하세요</option>
                    <option>근린생활시설</option>
                    <option>업무시설</option>
                    <option>공장</option>
                    <option>단독주택</option>
                  </select>
                </Field>
                {useBlocked && (
                  <Callout tone="warn">
                    건축물 용도가 근린생활시설이 아니어서 본 신고는 반려됩니다. 용도변경
                    후 다시 신고하세요.
                  </Callout>
                )}

                <Field
                  label="위생교육 이수일"
                  htmlFor="hygieneDate"
                  required
                  hint="이수한 지 2년이 지난 교육은 인정되지 않습니다."
                >
                  <input
                    id="hygieneDate"
                    name="hygieneDate"
                    type="date"
                    value={hygieneDate}
                    onChange={(e) => {
                      const value = e.target.value;
                      setHygieneDate(value);
                      setHygieneStale(
                        value !== "" &&
                          (Date.now() - new Date(value).getTime()) / 86_400_000 > 730,
                      );
                    }}
                    className={inputCls}
                  />
                </Field>
                {hygieneStale && (
                  <Callout tone="warn">
                    위생교육 이수일로부터 2년이 경과했습니다. 재이수 후 신고해야 합니다.
                  </Callout>
                )}
              </Fieldset>
            )}

            {step === 1 && (
              <Fieldset
                legend="지정서식 제출"
                desc="서식을 내려받아 한글로 작성한 뒤 HWP 파일 그대로 올리세요. PDF·이미지로 변환하면 접수되지 않습니다."
              >
                {FORMS.map((f) => {
                  const expected = f.pattern(shop, ceo);
                  const done = (uploads[f.id]?.length ?? 0) > 0;
                  return (
                    <div
                      key={f.id}
                      className="rounded border border-neutral-300 bg-white p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span
                            className={`${site.accentSoft} ${site.accentText} mr-2 rounded px-1.5 py-0.5 text-[11px] font-semibold`}
                          >
                            {f.no}
                          </span>
                          <span className="text-[13px] font-semibold text-neutral-800">
                            {f.title}
                          </span>
                          {done && (
                            <span className="ml-2 text-xs font-medium text-green-700">
                              제출됨 ✓
                            </span>
                          )}
                        </div>
                        <a
                          href={formHref(f.title)}
                          download={`${f.no}_${f.title}_지정서식.hwp`}
                          onClick={() =>
                            setDownloaded((d) => (d.includes(f.id) ? d : [...d, f.id]))
                          }
                          className="rounded border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
                        >
                          서식 내려받기 (.hwp)
                          {downloaded.includes(f.id) && (
                            <span className="ml-1.5 text-green-700">✓</span>
                          )}
                        </a>
                      </div>

                      <p className="mb-2 text-xs text-neutral-500">
                        제출 파일명 —{" "}
                        <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-800">
                          {expected}
                        </code>
                      </p>

                      <FileDrop
                        name={f.id}
                        accept=".hwp,.hwpx"
                        maxMB={20}
                        label="작성한 HWP 파일을 올려주세요"
                        validateName={(fileName) =>
                          f.re.test(fileName)
                            ? null
                            : `파일명이 규칙에 맞지 않습니다. 「${expected}」 형식이어야 합니다.`
                        }
                        onChange={(files) => setUploads((u) => ({ ...u, [f.id]: files }))}
                      />
                    </div>
                  );
                })}

                <Field
                  label="건강진단결과서 (보건증)"
                  required
                  hint="스캔 이미지 또는 PDF 허용"
                >
                  <FileDrop
                    name="health"
                    accept=".pdf,.jpg,.jpeg,.png"
                    maxMB={10}
                    onChange={setHealth}
                    label="보건증 스캔본을 올려주세요"
                  />
                </Field>

                <Field label="임대차계약서 사본" hint="자가 소유인 경우 생략 가능">
                  <FileDrop
                    name="lease"
                    accept=".pdf,.jpg,.jpeg,.png"
                    maxMB={10}
                    onChange={setLease}
                    label="임대차계약서 (해당 시)"
                  />
                </Field>
              </Fieldset>
            )}

            {step === 2 && (
              <Fieldset
                legend="전자서명"
                desc="공동인증서로 신고인 본인 확인을 진행합니다. 서명 없이는 접수가 확정되지 않습니다."
              >
                {signedAt ? (
                  <div className="rounded border border-green-300 bg-green-50 p-5 text-[13px]">
                    <p className="font-semibold text-green-900">
                      전자서명이 완료되었습니다
                    </p>
                    <p className="mt-1 text-green-800">
                      서명자 {ceo} · {signedAt}
                    </p>
                  </div>
                ) : (
                  <div className="rounded border border-neutral-300 bg-neutral-50 p-5">
                    <p className="text-[13px] font-semibold text-neutral-800">
                      공동인증서 선택
                    </p>
                    <div className="mt-3 rounded border border-neutral-300 bg-white px-3 py-2.5 text-[13px]">
                      <p className="font-medium text-neutral-900">
                        {ceo || "신고인"} (개인, 범용)
                      </p>
                      <p className="text-xs text-neutral-500">
                        발급기관 온빛인증센터 · 만료 2027-04-30
                      </p>
                    </div>
                    <div className="mt-3">
                      <label
                        htmlFor="certPassword"
                        className="text-[13px] font-medium text-neutral-800"
                      >
                        인증서 비밀번호 <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="certPassword"
                        name="certPassword"
                        type="password"
                        value={certPassword}
                        onChange={(e) => setCertPassword(e.target.value)}
                        className={`${inputCls} mt-1.5`}
                        placeholder="4자 이상 입력 (데모용)"
                      />
                      <p className="mt-1.5 text-xs text-neutral-500">
                        데모용입니다. 실제 인증은 이루어지지 않으며 입력값은 전송되지
                        않습니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={sign}
                      disabled={certPassword.length < 4 || signing}
                      className={`${site.accent} mt-4 rounded px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40`}
                    >
                      {signing ? "서명 중…" : "전자서명"}
                    </button>
                  </div>
                )}
              </Fieldset>
            )}

            {step === 3 && (
              <Fieldset legend="수수료 납부" desc="납부가 완료되어야 접수가 확정됩니다.">
                <div className="rounded border border-neutral-300 bg-neutral-50 p-4 text-[13px]">
                  <div className="flex justify-between py-1">
                    <span className="text-neutral-600">일반음식점 영업신고 수수료</span>
                    <span>28,000원</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-neutral-300 pt-2 font-bold">
                    <span>납부 금액</span>
                    <span className={site.accentText}>28,000원</span>
                  </div>
                </div>

                <Field label="납부 수단" required>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {["신용카드", "계좌이체", "전자수입인지"].map((m) => (
                      <label
                        key={m}
                        className="flex cursor-pointer items-center gap-2 rounded border border-neutral-300 px-3 py-2.5 text-[13px] has-checked:border-neutral-900 has-checked:bg-neutral-50"
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

                <Callout>
                  전자서명과 수수료 납부가 모두 끝나야 접수가 확정됩니다. 어느 하나라도
                  누락되면 제출한 서류는 <strong>7일 후 자동 폐기</strong>됩니다.
                </Callout>
              </Fieldset>
            )}

            <div className="flex items-center justify-between border-t border-neutral-200 pt-5">
              <button
                type="button"
                disabled={step === 0 || paying}
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
                  disabled={!step4Ok || paying}
                  className={`${site.accent} rounded px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40`}
                >
                  {paying ? "납부 처리 중…" : "28,000원 납부하고 신고"}
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
