"use client";

import * as React from "react";

/**
 * 데모 사이트용 폼 부품.
 *
 * 네이티브 컨트롤을 쓴다. 실제 관공서·기업 사이트가 그렇고, 브라우저 자동화가
 * 실제로 마주치는 대상도 그것이다. 우리 shadcn 프리미티브를 쓰면 외부 사이트로
 * 보이지 않는다.
 *
 * 모든 입력에 `name` 과 `id` 를 붙이고 label 을 연결한다 — 에이전트가 항목명을
 * 읽어 값을 매칭할 수 있어야 검증이 된다.
 */

export const inputCls =
  "w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-100 disabled:text-neutral-400";

export function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-neutral-800">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-neutral-500">{hint}</p>}
    </div>
  );
}

export function Fieldset({
  legend,
  desc,
  children,
}: {
  legend: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-t border-neutral-200 pt-6">
      <legend className="sr-only">{legend}</legend>
      <div className="mb-4">
        <h2 className="text-[15px] font-bold text-neutral-900">{legend}</h2>
        {desc && <p className="mt-1 text-xs text-neutral-500">{desc}</p>}
      </div>
      <div className="grid gap-5">{children}</div>
    </fieldset>
  );
}

export function Callout({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-neutral-200 bg-neutral-50 text-neutral-700";
  return (
    <div className={`rounded border px-4 py-3 text-[13px] leading-relaxed ${cls}`}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 파일 업로드 — 드래그앤드롭 + 규격 검증                                */
/* ------------------------------------------------------------------ */

export type PickedFile = { name: string; size: number; type: string };

export function FileDrop({
  name,
  accept,
  multiple = false,
  maxMB,
  label,
  onChange,
  validateName,
}: {
  name: string;
  accept: string;
  multiple?: boolean;
  maxMB: number;
  label?: string;
  onChange?: (files: PickedFile[]) => void;
  /** 파일명 규칙 검증. 문제가 있으면 사유를, 없으면 null 을 반환한다 */
  validateName?: (fileName: string) => string | null;
}) {
  const [files, setFiles] = React.useState<PickedFile[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [over, setOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const accepted = accept
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  function take(list: FileList | null) {
    if (!list || list.length === 0) return;
    const next: PickedFile[] = [];
    for (const f of Array.from(list)) {
      const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
      if (accepted.length && !accepted.includes(ext)) {
        setError(`허용되지 않는 형식입니다: ${ext} (허용 ${accept})`);
        return;
      }
      if (f.size > maxMB * 1024 * 1024) {
        setError(`${f.name} 이 ${maxMB}MB 를 초과합니다.`);
        return;
      }
      const nameError = validateName?.(f.name);
      if (nameError) {
        setError(nameError);
        return;
      }
      next.push({ name: f.name, size: f.size, type: f.type });
    }
    setError(null);
    const merged = multiple ? [...files, ...next] : next.slice(0, 1);
    setFiles(merged);
    onChange?.(merged);
  }

  function remove(i: number) {
    const merged = files.filter((_, idx) => idx !== i);
    setFiles(merged);
    onChange?.(merged);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded border-2 border-dashed px-4 py-7 text-center transition-colors ${
          over
            ? "border-neutral-900 bg-neutral-100"
            : "border-neutral-300 bg-neutral-50 hover:border-neutral-400"
        }`}
      >
        <p className="text-[13px] font-medium text-neutral-700">
          {label ?? "파일을 이곳에 끌어다 놓거나 클릭해 선택하세요"}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {accept} · 최대 {maxMB}MB{multiple ? " · 여러 개 가능" : ""}
        </p>
        <input
          ref={inputRef}
          id={name}
          name={name}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => take(e.target.files)}
        />
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}

      {files.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded border border-neutral-200 bg-white px-3 py-2 text-[13px]"
            >
              <span className="truncate text-neutral-800">{f.name}</span>
              <span className="ml-3 flex shrink-0 items-center gap-3">
                <span className="text-xs text-neutral-500">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(i);
                  }}
                  className="text-xs text-neutral-500 underline hover:text-red-600"
                >
                  삭제
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 동적 행 — 경력·세대원·팀원처럼 개수가 정해지지 않은 입력              */
/* ------------------------------------------------------------------ */

export function RepeatRows<T>({
  rows,
  setRows,
  blank,
  columns,
  render,
  addLabel,
  max = 10,
}: {
  rows: T[];
  setRows: (rows: T[]) => void;
  blank: () => T;
  columns: string[];
  render: (row: T, i: number, update: (patch: Partial<T>) => void) => React.ReactNode;
  addLabel: string;
  max?: number;
}) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-neutral-100">
              {columns.map((c) => (
                <th
                  key={c}
                  className="border border-neutral-300 px-2 py-1.5 text-left text-xs font-semibold text-neutral-600"
                >
                  {c}
                </th>
              ))}
              <th className="w-14 border border-neutral-300 px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {render(row, i, (patch) =>
                  setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r))),
                )}
                <td className="border border-neutral-300 px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                    className="text-xs text-neutral-500 underline hover:text-red-600"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="border border-neutral-300 px-3 py-6 text-center text-xs text-neutral-400"
                >
                  등록된 항목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled={rows.length >= max}
        onClick={() => setRows([...rows, blank()])}
        className="mt-2 rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
      >
        {addLabel}
      </button>
    </div>
  );
}

/** 표 안에 들어가는 셀 입력 */
export function Cell({ children }: { children: React.ReactNode }) {
  return <td className="border border-neutral-300 p-1">{children}</td>;
}

export const cellInputCls =
  "w-full rounded-sm border-0 bg-transparent px-2 py-1 text-[13px] text-neutral-900 outline-none focus:bg-neutral-50";

/* ------------------------------------------------------------------ */
/* 제출 완료                                                            */
/* ------------------------------------------------------------------ */

/** 접수번호는 제출 시각에서 만든다 — 렌더 중 난수를 쓰면 하이드레이션이 깨진다 */
export function receiptNo(prefix: string) {
  const d = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function Submitted({
  accent,
  receipt,
  summary,
  onReset,
  footer,
}: {
  accent: string;
  receipt: string;
  summary: { label: string; value: string }[];
  onReset: () => void;
  /** 요약 아래에 붙는 추가 블록 — 면접 일정처럼 접수 후 확정되는 정보 */
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
      <div
        className={`mx-auto flex size-12 items-center justify-center rounded-full ${accent} text-xl font-bold text-white`}
      >
        ✓
      </div>
      <h2 className="mt-4 text-lg font-bold text-neutral-900">접수가 완료되었습니다</h2>
      <p className="mt-1 text-[13px] text-neutral-500">
        접수번호{" "}
        <span className="font-mono font-semibold text-neutral-800">{receipt}</span>
      </p>

      <dl className="mx-auto mt-6 max-w-md text-left text-[13px]">
        {summary.map((s) => (
          <div
            key={s.label}
            className="flex gap-4 border-b border-neutral-100 py-2 last:border-0"
          >
            <dt className="w-28 shrink-0 text-neutral-500">{s.label}</dt>
            <dd className="break-all text-neutral-800">{s.value || "—"}</dd>
          </div>
        ))}
      </dl>

      {footer}

      <button
        type="button"
        onClick={onReset}
        className="mt-6 rounded border border-neutral-300 px-4 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50"
      >
        다시 작성하기
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 단계 표시                                                            */
/* ------------------------------------------------------------------ */

export function Steps({
  steps,
  current,
  accent,
}: {
  steps: string[];
  current: number;
  accent: string;
}) {
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px]">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
              i <= current ? `${accent} text-white` : "bg-neutral-200 text-neutral-500"
            }`}
          >
            {i + 1}
          </span>
          <span
            className={
              i === current ? "font-semibold text-neutral-900" : "text-neutral-500"
            }
          >
            {s}
          </span>
          {i < steps.length - 1 && <span className="ml-1 text-neutral-300">›</span>}
        </li>
      ))}
    </ol>
  );
}
