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
  FileDrop,
  inputCls,
  receiptNo,
  RepeatRows,
  Submitted,
  type PickedFile,
} from "../../_lib/fields";
import { getSite } from "../../_lib/sites";

const site = getSite("hiring");

type Career = {
  company: string;
  role: string;
  from: string;
  to: string;
  current: boolean;
};
type Edu = { school: string; major: string; degree: string; graduated: string };

/**
 * 신청 방식 2 — 한 화면, 대신 개수가 정해지지 않은 입력.
 *
 * 경력과 학력은 몇 줄이 될지 모른다. 행을 추가·삭제하는 표 입력이라 폼 구조가
 * 제출 시점에 결정된다. 이력서와 포트폴리오는 성격이 달라 업로드 슬롯도 나뉜다.
 */
type Interview = {
  date: string;
  time: string;
  endTime: string;
  place: string;
  interviewer: string;
};

export default function HiringApply() {
  const [receipt, setReceipt] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  // 서류 접수 직후 서버가 1차 면접 일정을 배정하고 메일로 보낸다
  const [interview, setInterview] = React.useState<Interview | null>(null);
  const [mailSent, setMailSent] = React.useState(false);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [source, setSource] = React.useState("");
  const [salary, setSalary] = React.useState("");
  const [start, setStart] = React.useState("");

  const [careers, setCareers] = React.useState<Career[]>([
    { company: "", role: "", from: "", to: "", current: false },
  ]);
  const [edus, setEdus] = React.useState<Edu[]>([
    { school: "", major: "", degree: "학사", graduated: "" },
  ]);

  const [resume, setResume] = React.useState<PickedFile[]>([]);
  const [portfolio, setPortfolio] = React.useState<PickedFile[]>([]);
  const [links, setLinks] = React.useState<string[]>([""]);
  const [cover, setCover] = React.useState("");
  const [agreed, setAgreed] = React.useState(false);

  const coverOk = cover.length >= 500 && cover.length <= 2000;
  const portfolioOk = portfolio.length > 0 || links.some((l) => l.trim().length > 0);
  const ok =
    name && email && phone && resume.length > 0 && portfolioOk && coverOk && agreed;

  /** 경력 총합 개월 — 자격요건(3년 이상)에 걸리는지 즉시 보여준다 */
  const months = careers.reduce((acc, c) => {
    if (!c.from) return acc;
    const from = new Date(c.from + "-01");
    const to = c.current ? new Date() : c.to ? new Date(c.to + "-01") : null;
    if (!to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return acc;
    return (
      acc +
      Math.max(
        0,
        (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()),
      )
    );
  }, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || submitting) return;
    setSubmitting(true);

    const no = receiptNo("DAON");
    try {
      const res = await fetch("/api/demo/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          position: "백엔드 엔지니어 (Server)",
          receipt: no,
        }),
      });
      const data = await res.json();
      // 메일이 실패해도 접수 자체는 성립한다. 발송 여부만 화면에 그대로 드러낸다.
      setInterview(data.interview ?? null);
      setMailSent(Boolean(data.sent));
    } catch {
      setInterview(null);
      setMailSent(false);
    } finally {
      setSubmitting(false);
      setReceipt(no);
      window.scrollTo({ top: 0 });
    }
  }

  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "회사소개" },
          { label: "서비스" },
          { label: "채용", active: true },
        ]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <Link
          href={`/demo/${site.slug}`}
          className="text-[13px] text-neutral-500 underline underline-offset-4"
        >
          ← 공고로
        </Link>
        <h1 className="mt-3 mb-8 text-xl font-bold">백엔드 엔지니어 지원서</h1>

        {receipt ? (
          <Submitted
            accent={site.accent}
            receipt={receipt}
            summary={[
              { label: "지원자", value: name },
              { label: "연락처", value: email },
              {
                label: "총 경력",
                value: `${Math.floor(months / 12)}년 ${months % 12}개월`,
              },
              { label: "이력서", value: resume[0]?.name ?? "" },
              {
                label: "포트폴리오",
                value:
                  portfolio.length > 0
                    ? portfolio.map((p) => p.name).join(", ")
                    : links.filter(Boolean).join(", "),
              },
            ]}
            onReset={() => {
              setReceipt(null);
              setInterview(null);
              setMailSent(false);
            }}
            footer={
              interview ? (
                <div className="mt-6 rounded-lg border border-neutral-200 bg-[#eaf5f2] p-5 text-left">
                  <p className="text-[13px] font-bold text-[#0f6f5c]">1차 면접 일정</p>
                  <dl className="mt-3 grid gap-1.5 text-[13px]">
                    <div className="flex gap-4">
                      <dt className="w-16 shrink-0 text-neutral-500">일시</dt>
                      <dd className="font-semibold text-neutral-900">
                        {interview.date} {interview.time}~{interview.endTime}
                      </dd>
                    </div>
                    <div className="flex gap-4">
                      <dt className="w-16 shrink-0 text-neutral-500">장소</dt>
                      <dd className="text-neutral-800">{interview.place}</dd>
                    </div>
                    <div className="flex gap-4">
                      <dt className="w-16 shrink-0 text-neutral-500">면접관</dt>
                      <dd className="text-neutral-800">{interview.interviewer}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 border-t border-[#0f6f5c]/15 pt-3 text-xs text-neutral-600">
                    {mailSent ? (
                      <>
                        <strong className="text-[#0f6f5c]">{email}</strong> 로 일정 안내
                        메일을 보냈습니다. 캘린더 초대장(.ics)이 첨부되어 있습니다.
                      </>
                    ) : (
                      <span className="text-amber-800">
                        메일 발송이 설정되지 않아 안내 메일을 보내지 못했습니다. 일정은
                        위와 같습니다 (SMTP_* 환경변수 확인).
                      </span>
                    )}
                  </p>
                </div>
              ) : null
            }
          />
        ) : (
          <form onSubmit={submit} className="grid gap-8">
            <Fieldset legend="기본 정보">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="이름" htmlFor="name" required>
                  <input
                    id="name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="이메일" htmlFor="email" required>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="휴대전화" htmlFor="phone" required>
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
                <Field label="지원 경로" htmlFor="source">
                  <select
                    id="source"
                    name="source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">선택하세요</option>
                    <option>채용 사이트</option>
                    <option>지인 추천</option>
                    <option>회사 블로그</option>
                    <option>컨퍼런스·밋업</option>
                    <option>기타</option>
                  </select>
                </Field>
                <Field
                  label="희망 연봉 (만원)"
                  htmlFor="salary"
                  hint="협의 가능 시 비워두세요"
                >
                  <input
                    id="salary"
                    name="salary"
                    type="number"
                    min={0}
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="입사 가능일" htmlFor="start">
                  <input
                    id="start"
                    name="start"
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </Fieldset>

            <Fieldset
              legend="경력"
              desc={`총 ${Math.floor(months / 12)}년 ${months % 12}개월 — 자격요건은 3년 이상입니다.`}
            >
              <RepeatRows<Career>
                rows={careers}
                setRows={setCareers}
                blank={() => ({
                  company: "",
                  role: "",
                  from: "",
                  to: "",
                  current: false,
                })}
                columns={["회사명", "직무", "입사", "퇴사", "재직중"]}
                addLabel="+ 경력 추가"
                render={(row, i, update) => (
                  <>
                    <Cell>
                      <input
                        name={`career-${i}-company`}
                        value={row.company}
                        onChange={(e) => update({ company: e.target.value })}
                        className={cellInputCls}
                      />
                    </Cell>
                    <Cell>
                      <input
                        name={`career-${i}-role`}
                        value={row.role}
                        onChange={(e) => update({ role: e.target.value })}
                        className={cellInputCls}
                      />
                    </Cell>
                    <Cell>
                      <input
                        name={`career-${i}-from`}
                        type="month"
                        value={row.from}
                        onChange={(e) => update({ from: e.target.value })}
                        className={cellInputCls}
                      />
                    </Cell>
                    <Cell>
                      <input
                        name={`career-${i}-to`}
                        type="month"
                        value={row.to}
                        disabled={row.current}
                        onChange={(e) => update({ to: e.target.value })}
                        className={`${cellInputCls} disabled:text-neutral-400`}
                      />
                    </Cell>
                    <Cell>
                      <input
                        name={`career-${i}-current`}
                        type="checkbox"
                        checked={row.current}
                        onChange={(e) =>
                          update({ current: e.target.checked, to: "" } as Partial<Career>)
                        }
                        className="mx-auto block"
                      />
                    </Cell>
                  </>
                )}
              />
              {months > 0 && months < 36 && (
                <Callout tone="warn">
                  입력된 경력이 3년 미만입니다. 지원은 가능하나 서류 단계에서 자격요건
                  검토 대상이 됩니다.
                </Callout>
              )}
            </Fieldset>

            <Fieldset legend="학력">
              <RepeatRows<Edu>
                rows={edus}
                setRows={setEdus}
                blank={() => ({ school: "", major: "", degree: "학사", graduated: "" })}
                columns={["학교명", "전공", "학위", "졸업"]}
                addLabel="+ 학력 추가"
                max={5}
                render={(row, i, update) => (
                  <>
                    <Cell>
                      <input
                        name={`edu-${i}-school`}
                        value={row.school}
                        onChange={(e) => update({ school: e.target.value })}
                        className={cellInputCls}
                      />
                    </Cell>
                    <Cell>
                      <input
                        name={`edu-${i}-major`}
                        value={row.major}
                        onChange={(e) => update({ major: e.target.value })}
                        className={cellInputCls}
                      />
                    </Cell>
                    <Cell>
                      <select
                        name={`edu-${i}-degree`}
                        value={row.degree}
                        onChange={(e) => update({ degree: e.target.value })}
                        className={cellInputCls}
                      >
                        <option>고졸</option>
                        <option>전문학사</option>
                        <option>학사</option>
                        <option>석사</option>
                        <option>박사</option>
                      </select>
                    </Cell>
                    <Cell>
                      <input
                        name={`edu-${i}-graduated`}
                        type="month"
                        value={row.graduated}
                        onChange={(e) => update({ graduated: e.target.value })}
                        className={cellInputCls}
                      />
                    </Cell>
                  </>
                )}
              />
            </Fieldset>

            <Fieldset legend="제출 서류">
              <Field label="이력서" required hint="PDF 만 허용 · 최대 10MB">
                <FileDrop
                  name="resume"
                  accept=".pdf"
                  maxMB={10}
                  onChange={setResume}
                  label="이력서 PDF 를 올려주세요"
                />
              </Field>

              <Field
                label="포트폴리오"
                required
                hint="파일 또는 링크 중 하나 이상. 비공개 저장소는 열람할 수 없습니다."
              >
                <FileDrop
                  name="portfolio"
                  accept=".pdf,.zip"
                  multiple
                  maxMB={50}
                  onChange={setPortfolio}
                  label="포트폴리오 파일 (선택)"
                />
                <div className="mt-3 grid gap-2">
                  {links.map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        name={`link-${i}`}
                        type="url"
                        value={link}
                        onChange={(e) =>
                          setLinks(
                            links.map((l, idx) => (idx === i ? e.target.value : l)),
                          )
                        }
                        className={inputCls}
                        placeholder="https://github.com/..."
                      />
                      {links.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLinks(links.filter((_, idx) => idx !== i))}
                          className="shrink-0 rounded border border-neutral-300 px-3 text-xs text-neutral-600"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setLinks([...links, ""])}
                    className="w-fit rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    + 링크 추가
                  </button>
                </div>
              </Field>

              <Field
                label="자기소개서"
                htmlFor="cover"
                required
                hint={
                  <span
                    className={
                      coverOk || cover.length === 0 ? "" : "font-medium text-red-600"
                    }
                  >
                    {cover.length} / 500자 이상 2000자 이내 · 파일 첨부로 대체할 수
                    없습니다
                  </span>
                }
              >
                <textarea
                  id="cover"
                  name="cover"
                  rows={10}
                  maxLength={2000}
                  value={cover}
                  onChange={(e) => setCover(e.target.value)}
                  className={inputCls}
                  placeholder="가장 몰입했던 문제와 그것을 어떻게 풀었는지 적어주세요."
                />
              </Field>

              <label className="flex items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  name="agree"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-neutral-700">
                  채용 전형 목적의 개인정보 수집·이용에 동의하며, 불합격 시 1년간 보관 후
                  파기됨을 확인했습니다. <span className="text-red-600">*</span>
                </span>
              </label>
            </Fieldset>

            <div className="flex justify-end border-t border-neutral-200 pt-5">
              <button
                type="submit"
                disabled={!ok || submitting}
                className={`${site.accent} rounded px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40`}
              >
                {submitting ? "접수 중…" : "지원서 제출"}
              </button>
            </div>
          </form>
        )}
      </main>
      <DemoFooter site={site} />
    </>
  );
}
