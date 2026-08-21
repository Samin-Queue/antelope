"use client";

import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import { DemoFooter, DemoHeader } from "../../_lib/chrome";
import {
  Callout,
  Field,
  Fieldset,
  inputCls,
  receiptNo,
  Steps,
  Submitted,
} from "../../_lib/fields";
import { getSite } from "../../_lib/sites";

const site = getSite("cert-exam");

/** 지역 → 고사장 → 교시. 앞을 고르지 않으면 뒤가 열리지 않는다. */
const VENUES: Record<string, { name: string; seatsLeft: number; slots: string[] }[]> = {
  "경북 포항": [
    { name: "포항정보고등학교", seatsLeft: 42, slots: ["1교시 09:30", "2교시 13:30"] },
    { name: "포항제철중학교", seatsLeft: 0, slots: ["1교시 09:30"] },
  ],
  "경북 구미": [
    {
      name: "구미전자정보고등학교",
      seatsLeft: 118,
      slots: ["1교시 09:30", "2교시 13:30", "3교시 16:00"],
    },
  ],
  대구: [
    { name: "대구소프트웨어마이스터고", seatsLeft: 7, slots: ["2교시 13:30"] },
    { name: "경명여자고등학교", seatsLeft: 95, slots: ["1교시 09:30", "2교시 13:30"] },
  ],
  서울: [
    { name: "선린인터넷고등학교", seatsLeft: 210, slots: ["1교시 09:30", "2교시 13:30"] },
    { name: "한강미디어고등학교", seatsLeft: 63, slots: ["1교시 09:30"] },
  ],
};

const FEE: Record<string, number> = { "1급": 38000, "2급": 24000 };
const STEPS = ["종목·자격", "고사장 선택", "증명사진", "응시료 결제"];

/**
 * 신청 방식 4 — 선택이 선택을 여는 구조 + 결제.
 *
 * 지역을 골라야 고사장이, 고사장을 골라야 교시가 나온다. 정원이 찬 고사장은
 * 목록에 있으나 고를 수 없다. 마지막에 결제 단계가 있어서 폼을 다 채워도
 * 결제하지 않으면 접수가 확정되지 않는다.
 */
export default function CertExamApply() {
  const [step, setStep] = React.useState(0);
  const [receipt, setReceipt] = React.useState<string | null>(null);

  const [grade, setGrade] = React.useState("");
  const [qualification, setQualification] = React.useState("");
  const [retake, setRetake] = React.useState(false);
  const [name, setName] = React.useState("");
  const [birth, setBirth] = React.useState("");
  const [phone, setPhone] = React.useState("");

  const [region, setRegion] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [slot, setSlot] = React.useState("");

  const [photo, setPhoto] = React.useState<{
    url: string;
    name: string;
    size: number;
  } | null>(null);
  const [photoError, setPhotoError] = React.useState<string | null>(null);

  const [payMethod, setPayMethod] = React.useState("");
  const [cardNo, setCardNo] = React.useState("");
  const [paying, setPaying] = React.useState(false);

  const venues = region ? VENUES[region] : [];
  const slots = venues.find((v) => v.name === venue)?.slots ?? [];

  const base = FEE[grade] ?? 0;
  const fee = retake ? Math.round(base / 2) : base;

  // 1급을 고르면 자격 근거를 반드시 선택해야 한다
  const step1Ok = grade && name && birth && phone && (grade === "2급" || qualification);
  const step2Ok = region && venue && slot;
  const step3Ok = photo !== null;
  const step4Ok = payMethod !== "" && (payMethod !== "신용카드" || cardNo.length >= 12);
  const okByStep = [step1Ok, step2Ok, step3Ok, step4Ok];

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (![".jpg", ".jpeg", ".png"].includes(ext)) {
      setPhotoError(`JPG 또는 PNG 만 업로드할 수 있습니다 (${ext})`);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("증명사진은 2MB 를 초과할 수 없습니다.");
      return;
    }
    setPhotoError(null);
    setPhoto({ url: URL.createObjectURL(file), name: file.name, size: file.size });
  }

  React.useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!step4Ok) return;
    setPaying(true);
    // 결제 승인 대기를 흉내낸다 — 즉시 완료되면 결제 단계가 있는 티가 안 난다
    window.setTimeout(() => {
      setPaying(false);
      setReceipt(receiptNo("KITQ"));
      window.scrollTo({ top: 0 });
    }, 1200);
  }

  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "자격안내" },
          { label: "원서접수", active: true },
          { label: "합격조회" },
        ]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <Link
          href={`/demo/${site.slug}`}
          className="text-[13px] text-neutral-500 underline underline-offset-4"
        >
          ← 공고문으로
        </Link>
        <h1 className="mt-3 mb-8 text-xl font-bold">제38회 원서접수</h1>

        {receipt ? (
          <Submitted
            accent={site.accent}
            receipt={receipt}
            summary={[
              { label: "응시자", value: name },
              { label: "검정종목", value: grade },
              { label: "고사장", value: `${venue} ${slot}` },
              { label: "결제금액", value: `${fee.toLocaleString()}원 (${payMethod})` },
              { label: "시험일", value: "2026.09.20(일)" },
            ]}
            onReset={() => {
              setReceipt(null);
              setStep(0);
            }}
          />
        ) : (
          <form onSubmit={pay} className="grid gap-8">
            <Steps steps={STEPS} current={step} accent={site.accent} />

            {step === 0 && (
              <Fieldset legend="검정종목 및 응시자격">
                <Field label="검정종목" required>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["2급", "1급"] as const).map((g) => (
                      <label
                        key={g}
                        className="flex cursor-pointer items-start gap-2.5 rounded border border-neutral-300 px-3 py-2.5 has-checked:border-neutral-900 has-checked:bg-neutral-50"
                      >
                        <input
                          type="radio"
                          name="grade"
                          value={g}
                          checked={grade === g}
                          onChange={() => {
                            setGrade(g);
                            setQualification("");
                          }}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-[13px] font-medium">{g}</span>
                          <span className="block text-xs text-neutral-500">
                            응시료 {FEE[g].toLocaleString()}원
                            {g === "2급" ? " · 자격 제한 없음" : " · 자격 요건 있음"}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>

                {grade === "1급" && (
                  <Field
                    label="응시자격 근거"
                    htmlFor="qualification"
                    required
                    hint="자격 확인이 되지 않으면 접수가 취소되며 응시료는 반환되지 않습니다."
                  >
                    <select
                      id="qualification"
                      name="qualification"
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">선택하세요</option>
                      <option>본 검정 2급 취득 후 실무경력 1년 이상</option>
                      <option>관련 학과 전문학사 이상 졸업(예정)</option>
                      <option>관련 학과 4학기 이상 이수</option>
                      <option>동일 직무분야 실무경력 3년 이상</option>
                    </select>
                  </Field>
                )}

                <label className="flex items-start gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    name="retake"
                    checked={retake}
                    onChange={(e) => setRetake(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-neutral-700">
                    직전 회차(제37회) 불합격자입니다 — <strong>응시료 50% 할인</strong>
                  </span>
                </label>

                <div className="grid gap-5 sm:grid-cols-3">
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
                    />
                  </Field>
                </div>
              </Fieldset>
            )}

            {step === 1 && (
              <Fieldset
                legend="고사장 선택"
                desc="지역을 선택하면 고사장이, 고사장을 선택하면 교시가 나타납니다. 접수 후 변경은 불가합니다."
              >
                <Field label="응시 지역" htmlFor="region" required>
                  <select
                    id="region"
                    name="region"
                    value={region}
                    onChange={(e) => {
                      setRegion(e.target.value);
                      setVenue("");
                      setSlot("");
                    }}
                    className={inputCls}
                  >
                    <option value="">선택하세요</option>
                    {Object.keys(VENUES).map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>

                <Field label="고사장" htmlFor="venue" required>
                  <select
                    id="venue"
                    name="venue"
                    value={venue}
                    disabled={!region}
                    onChange={(e) => {
                      setVenue(e.target.value);
                      setSlot("");
                    }}
                    className={inputCls}
                  >
                    <option value="">
                      {region ? "선택하세요" : "지역을 먼저 선택하세요"}
                    </option>
                    {venues.map((v) => (
                      <option key={v.name} value={v.name} disabled={v.seatsLeft === 0}>
                        {v.name}
                        {v.seatsLeft === 0 ? " — 접수 마감" : ` — 잔여 ${v.seatsLeft}석`}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="교시" htmlFor="slot" required>
                  <select
                    id="slot"
                    name="slot"
                    value={slot}
                    disabled={!venue}
                    onChange={(e) => setSlot(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">
                      {venue ? "선택하세요" : "고사장을 먼저 선택하세요"}
                    </option>
                    {slots.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>

                {venue && (venues.find((v) => v.name === venue)?.seatsLeft ?? 0) < 20 && (
                  <Callout tone="warn">
                    잔여 좌석이 얼마 남지 않았습니다. 결제를 완료해야 좌석이 확정됩니다.
                  </Callout>
                )}
              </Fieldset>
            )}

            {step === 2 && (
              <Fieldset
                legend="증명사진 등록"
                desc="최근 6개월 이내 촬영한 탈모 상반신 · 3.5cm × 4.5cm 비율 · JPG/PNG · 2MB 이하"
              >
                <div className="flex flex-col gap-6 sm:flex-row">
                  <div className="shrink-0">
                    <div className="flex h-[180px] w-[140px] items-center justify-center overflow-hidden rounded border border-neutral-300 bg-neutral-100">
                      {photo ? (
                        <Image
                          src={photo.url}
                          alt="증명사진 미리보기"
                          width={140}
                          height={180}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-neutral-400">미리보기</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-center text-[11px] text-neutral-400">
                      3.5 × 4.5 cm
                    </p>
                  </div>

                  <div className="flex-1">
                    <Field label="사진 파일" htmlFor="photo" required>
                      <input
                        id="photo"
                        name="photo"
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) => pickPhoto(e.target.files?.[0])}
                        className={`${inputCls} file:mr-3 file:rounded file:border-0 file:bg-neutral-200 file:px-3 file:py-1 file:text-xs`}
                      />
                    </Field>
                    {photoError && (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {photoError}
                      </p>
                    )}
                    {photo && (
                      <p className="mt-2 text-xs text-neutral-500">
                        {photo.name} · {(photo.size / 1024).toFixed(0)} KB
                      </p>
                    )}
                    <ul className="mt-4 list-disc space-y-1 pl-4 text-xs leading-relaxed text-neutral-500">
                      <li>배경에 무늬가 있는 사진은 반려됩니다</li>
                      <li>모자·선글라스 착용 사진은 반려됩니다</li>
                      <li>셀프 촬영 사진은 반려됩니다</li>
                    </ul>
                  </div>
                </div>
              </Fieldset>
            )}

            {step === 3 && (
              <Fieldset legend="응시료 결제" desc="결제가 완료되어야 접수가 확정됩니다.">
                <div className="rounded border border-neutral-300 bg-neutral-50 p-4 text-[13px]">
                  <div className="flex justify-between py-1">
                    <span className="text-neutral-600">{grade} 응시료</span>
                    <span>{base.toLocaleString()}원</span>
                  </div>
                  {retake && (
                    <div className="flex justify-between py-1 text-neutral-600">
                      <span>재응시 할인 (50%)</span>
                      <span>-{(base - fee).toLocaleString()}원</span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between border-t border-neutral-300 pt-2 font-bold">
                    <span>결제 금액</span>
                    <span className={site.accentText}>{fee.toLocaleString()}원</span>
                  </div>
                </div>

                <Field label="결제 수단" required>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {["신용카드", "계좌이체", "가상계좌"].map((m) => (
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

                {payMethod === "신용카드" && (
                  <Field
                    label="카드번호"
                    htmlFor="cardNo"
                    required
                    hint="데모용입니다. 실제 결제는 이루어지지 않으며 입력값은 전송되지 않습니다."
                  >
                    <input
                      id="cardNo"
                      name="cardNo"
                      inputMode="numeric"
                      value={cardNo}
                      onChange={(e) => setCardNo(e.target.value)}
                      className={inputCls}
                      placeholder="0000 0000 0000 0000"
                    />
                  </Field>
                )}

                {payMethod === "가상계좌" && (
                  <Callout>
                    발급된 가상계좌로 <strong>마감 전까지</strong> 입금해야 접수가
                    확정됩니다. 미입금 시 마감과 동시에 자동 취소됩니다.
                  </Callout>
                )}
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
                  {paying ? "결제 승인 중…" : `${fee.toLocaleString()}원 결제하고 접수`}
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
