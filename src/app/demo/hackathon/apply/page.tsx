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

const site = getSite("hackathon");

type Mate = { email: string; role: string; invited: boolean };

const GITHUB_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;

/**
 * 신청 방식 5 — 제출물마다 형식이 다르고, 형식을 클라이언트가 검증한다.
 *
 * 파일·링크·URL 이 섞여 있고 각각 다른 규칙을 갖는다. 팀원은 이메일로 초대해야
 * 하며 초대를 보내기 전에는 확정되지 않는다. 압축파일은 규정상 반려 대상이라
 * 업로드 자체를 막는다.
 */
export default function HackathonApply() {
  const [receipt, setReceipt] = React.useState<string | null>(null);

  const [team, setTeam] = React.useState("");
  const [leader, setLeader] = React.useState("");
  const [leaderEmail, setLeaderEmail] = React.useState("");
  const [mates, setMates] = React.useState<Mate[]>([]);
  const [mateDraft, setMateDraft] = React.useState("");

  const [title, setTitle] = React.useState("");
  const [problem, setProblem] = React.useState("");
  const [datasets, setDatasets] = React.useState<string[]>([""]);

  const [proposal, setProposal] = React.useState<PickedFile[]>([]);
  const [deck, setDeck] = React.useState<PickedFile[]>([]);
  const [videoUrl, setVideoUrl] = React.useState("");
  const [repoUrl, setRepoUrl] = React.useState("");
  const [demoUrl, setDemoUrl] = React.useState("");

  const [original, setOriginal] = React.useState(false);
  const [agreed, setAgreed] = React.useState(false);

  const repoValid = repoUrl === "" || GITHUB_RE.test(repoUrl.trim());
  const usedDatasets = datasets.filter((d) => d.trim().length > 0);
  const teamSize = 1 + mates.length;
  const teamOver = teamSize > 5;

  const ok =
    team &&
    leader &&
    leaderEmail &&
    title &&
    problem.length >= 50 &&
    usedDatasets.length > 0 &&
    proposal.length > 0 &&
    videoUrl &&
    repoUrl &&
    repoValid &&
    !teamOver &&
    mates.every((m) => m.invited) &&
    original &&
    agreed;

  function addMate() {
    const email = mateDraft.trim();
    if (!email || !email.includes("@")) return;
    if (mates.some((m) => m.email === email) || email === leaderEmail) return;
    setMates([...mates, { email, role: "팀원", invited: false }]);
    setMateDraft("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setReceipt(receiptNo("OIC"));
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      <DemoHeader
        site={site}
        nav={[
          { label: "공모전 소개" },
          { label: "접수", active: true },
          { label: "FAQ" },
        ]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <Link
          href={`/demo/${site.slug}`}
          className="text-[13px] text-neutral-500 underline underline-offset-4"
        >
          ← 공고로
        </Link>
        <h1 className="mt-3 mb-8 text-xl font-bold">제7회 공모전 출품 접수</h1>

        {receipt ? (
          <Submitted
            accent={site.accent}
            receipt={receipt}
            summary={[
              { label: "팀명", value: team },
              { label: "팀 구성", value: `${teamSize}명` },
              { label: "출품작", value: title },
              { label: "활용 데이터", value: usedDatasets.join(", ") },
              { label: "저장소", value: repoUrl },
              {
                label: "제출물",
                value: [
                  `기획서 ${proposal.length}건`,
                  deck.length > 0 ? "발표자료 포함" : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            ]}
            onReset={() => setReceipt(null)}
          />
        ) : (
          <form onSubmit={submit} className="grid gap-8">
            <Fieldset
              legend="팀 정보"
              desc="1인 이상 5인 이하. 팀장은 접수 계정 소유자여야 합니다."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="팀명" htmlFor="team" required>
                  <input
                    id="team"
                    name="team"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="팀장 성명" htmlFor="leader" required>
                  <input
                    id="leader"
                    name="leader"
                    value={leader}
                    onChange={(e) => setLeader(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="팀장 이메일" htmlFor="leaderEmail" required>
                <input
                  id="leaderEmail"
                  name="leaderEmail"
                  type="email"
                  value={leaderEmail}
                  onChange={(e) => setLeaderEmail(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <Field
                label={`팀원 초대 (현재 ${teamSize}명)`}
                hint="초대를 보내야 팀원이 확정됩니다. 한 사람이 두 팀에 속하면 모든 팀이 실격됩니다."
              >
                <div className="flex gap-2">
                  <input
                    name="mateDraft"
                    type="email"
                    value={mateDraft}
                    onChange={(e) => setMateDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addMate();
                      }
                    }}
                    className={inputCls}
                    placeholder="팀원 이메일 입력 후 Enter"
                  />
                  <button
                    type="button"
                    onClick={addMate}
                    disabled={teamSize >= 5}
                    className="shrink-0 rounded border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                  >
                    추가
                  </button>
                </div>

                {mates.length > 0 && (
                  <ul className="mt-2 grid gap-1.5">
                    {mates.map((m, i) => (
                      <li
                        key={m.email}
                        className="flex items-center justify-between rounded border border-neutral-200 bg-white px-3 py-2 text-[13px]"
                      >
                        <span className="truncate text-neutral-800">{m.email}</span>
                        <span className="ml-3 flex shrink-0 items-center gap-3">
                          <select
                            name={`mate-${i}-role`}
                            value={m.role}
                            onChange={(e) =>
                              setMates(
                                mates.map((x, idx) =>
                                  idx === i ? { ...x, role: e.target.value } : x,
                                ),
                              )
                            }
                            className="rounded border border-neutral-200 px-1.5 py-0.5 text-xs"
                          >
                            <option>팀원</option>
                            <option>개발</option>
                            <option>디자인</option>
                            <option>기획</option>
                          </select>
                          {m.invited ? (
                            <span className="text-xs font-medium text-green-700">
                              초대됨 ✓
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setMates(
                                  mates.map((x, idx) =>
                                    idx === i ? { ...x, invited: true } : x,
                                  ),
                                )
                              }
                              className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white"
                            >
                              초대 보내기
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setMates(mates.filter((_, idx) => idx !== i))}
                            className="text-xs text-neutral-500 underline hover:text-red-600"
                          >
                            삭제
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {teamOver && (
                  <Callout tone="warn">팀은 5인을 초과할 수 없습니다.</Callout>
                )}
              </Field>
            </Fieldset>

            <Fieldset legend="출품작 개요">
              <Field label="출품작 제목" htmlFor="title" required>
                <input
                  id="title"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field
                label="해결하려는 문제"
                htmlFor="problem"
                required
                hint={`${problem.length} / 최소 50자`}
              >
                <textarea
                  id="problem"
                  name="problem"
                  rows={5}
                  maxLength={800}
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field
                label="활용한 공공데이터"
                required
                hint="최소 1종 이상 실제로 연동해야 합니다. 화면만 있고 연동이 없으면 데이터 활용 항목 0점 처리됩니다."
              >
                <div className="grid gap-2">
                  {datasets.map((d, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        name={`dataset-${i}`}
                        value={d}
                        onChange={(e) =>
                          setDatasets(
                            datasets.map((x, idx) => (idx === i ? e.target.value : x)),
                          )
                        }
                        className={inputCls}
                        placeholder="예) 국민연금공단_사업장 가입내역"
                      />
                      {datasets.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDatasets(datasets.filter((_, idx) => idx !== i))
                          }
                          className="shrink-0 rounded border border-neutral-300 px-3 text-xs text-neutral-600"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDatasets([...datasets, ""])}
                    className="w-fit rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    + 데이터셋 추가
                  </button>
                </div>
              </Field>
            </Fieldset>

            <Fieldset
              legend="제출물"
              desc="압축파일(.zip, .rar)로 묶어 제출한 경우 심사 대상에서 제외됩니다."
            >
              <Field label="기획서" required hint="PDF · 10페이지 이내 · 20MB 이하">
                <FileDrop
                  name="proposal"
                  accept=".pdf"
                  maxMB={20}
                  onChange={setProposal}
                  label="기획서 PDF 를 끌어다 놓으세요"
                />
              </Field>

              <Field label="발표자료" hint="선택 · PDF 또는 PPTX · 50MB 이하">
                <FileDrop
                  name="deck"
                  accept=".pdf,.pptx"
                  maxMB={50}
                  onChange={setDeck}
                  label="발표자료 (선택)"
                />
              </Field>

              <Field
                label="시연 영상 링크"
                htmlFor="videoUrl"
                required
                hint="3분 이내 · YouTube 비공개 링크 허용"
              >
                <input
                  id="videoUrl"
                  name="videoUrl"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className={inputCls}
                  placeholder="https://youtu.be/..."
                />
              </Field>

              <Field
                label="소스코드 저장소"
                htmlFor="repoUrl"
                required
                hint={
                  repoValid ? (
                    "공개 GitHub 저장소만 인정됩니다."
                  ) : (
                    <span className="font-medium text-red-600">
                      https://github.com/사용자/저장소 형식이어야 합니다.
                    </span>
                  )
                }
              >
                <input
                  id="repoUrl"
                  name="repoUrl"
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className={`${inputCls} ${repoValid ? "" : "border-red-500"}`}
                  placeholder="https://github.com/team/project"
                />
              </Field>

              <Field label="데모 URL" htmlFor="demoUrl" hint="선택 · 배포된 서비스 주소">
                <input
                  id="demoUrl"
                  name="demoUrl"
                  type="url"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </Fieldset>

            <Fieldset legend="확인 사항">
              <label className="flex items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  name="original"
                  checked={original}
                  onChange={(e) => setOriginal(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-neutral-700">
                  출품작은 순수 창작물이며, 타인의 저작물을 무단 사용하거나 기존 공모전
                  수상작을 재출품하지 않았습니다. <span className="text-red-600">*</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  name="agree"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-neutral-700">
                  주최 측이 홍보 목적으로 출품작의 명칭과 개요를 사용하는 데 동의하며,
                  위반 시 수상 취소 및 상금 환수에 동의합니다.{" "}
                  <span className="text-red-600">*</span>
                </span>
              </label>
            </Fieldset>

            <div className="flex items-center justify-between border-t border-neutral-200 pt-5">
              <p className="text-xs text-neutral-500">
                마감 {site.deadline} · 마감 후 수정 불가
              </p>
              <button
                type="submit"
                disabled={!ok}
                className={`${site.accent} rounded px-6 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40`}
              >
                출품 접수
              </button>
            </div>
          </form>
        )}
      </main>
      <DemoFooter site={site} />
    </>
  );
}
