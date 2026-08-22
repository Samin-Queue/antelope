import type { Need, NeedKind } from "./types";

/**
 * 입력 항목 병합.
 *
 * 같은 것을 두 번 묻는 게 최악이다. "사업자등록번호" 와 "사업자 등록 번호" 는
 * 하나여야 하므로 공백·기호를 뺀 라벨을 키로 쓴다. 먼저 온 목록이 우선이다 —
 * 정보 분석(원문 정밀 분석)이 research(추론)보다 앞에 온다.
 */
export function normalizeKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[\s\-_·.,:()（）*※]/g, "")
    .replace(/필수|선택/g, "")
    .trim();
}

export function makeNeed(input: {
  label: string;
  kind?: string | null;
  /** select 일 때 고를 수 있는 값. 없으면 자유 입력으로 그려진다 */
  options?: string[] | null;
  required?: boolean | null;
  source: Need["source"];
  why?: string | null;
}): Need | null {
  const label = input.label.trim().replace(/\s*\*$/, "");
  if (!label || label.length > 60) return null;
  // 예시 값·URL·전화번호 패턴은 항목이 아니다. 플레이스홀더가 새어 들어온 것이다.
  if (/^https?:\/\/|^[\d\s\-().+]{6,}$|^[\w.+-]+@[\w-]+\.[\w.]+$/.test(label))
    return null;
  const options = (input.options ?? [])
    .map((option) => String(option).trim())
    .filter(Boolean)
    .slice(0, 12);

  return {
    key: normalizeKey(label),
    label,
    kind: toKind(input.kind),
    ...(options.length > 1 ? { options } : {}),
    required: input.required ?? false,
    source: input.source,
    why: input.why?.trim().slice(0, 160) || null,
    value: null,
    from: null,
  };
}

const KIND_MAP: Record<string, NeedKind> = {
  text: "text",
  textarea: "long",
  long: "long",
  date: "date",
  number: "number",
  money: "number",
  select: "select",
  checkbox: "checkbox",
  file: "file",
};

function toKind(value: string | null | undefined): NeedKind {
  return KIND_MAP[(value ?? "text").toLowerCase()] ?? "text";
}

export function mergeNeeds(...lists: Need[][]): Need[] {
  const byKey = new Map<string, Need>();
  for (const list of lists) {
    for (const need of list) {
      const existing = byKey.get(need.key);
      if (!existing) {
        byKey.set(need.key, need);
        continue;
      }
      // 뒤에 온 목록이 필수라고 하면 필수로 올린다. 근거는 없던 것만 보탠다.
      byKey.set(need.key, {
        ...existing,
        required: existing.required || need.required,
        why: existing.why ?? need.why,
      });
    }
  }
  return [...byKey.values()];
}
