import type { Need, NeedKind } from "./types";

/**
 * 입력 항목 병합.
 *
 * 같은 것을 두 번 묻는 게 최악이다. "사업자등록번호" 와 "사업자 등록 번호" 는
 * 하나여야 하므로 공백·기호를 뺀 라벨을 키로 쓴다. 먼저 온 목록이 우선이다 —
 * 정보 분석(원문 정밀 분석)이 research(추론)보다 앞에 온다.
 */
/**
 * 항목을 뽑을 때 모델에게 주는 규칙.
 *
 * `research.deriveNeeds` 와 `reconcile` 이 **글자 하나 안 틀리고 같은 문장**을
 * 각자 들고 있었다. 계약은 스키마에서 파생되지만 이런 규칙은 사람이 쓰는
 * 것이라, 뽑아 두지 않으면 한쪽만 고치는 사고가 정확히 두 배가 된다.
 */
export const NEED_RULES = [
  "- **`select` 이면 `options` 에 고를 값을 넣는다.** 원문에 선택지가 적혀 있으면 그대로, 없으면 그 항목에서 실제로 가능한 값(예: 투자 단계 → 시드/시리즈 A/시리즈 B/해당 없음). 선택지를 못 만들겠으면 `text` 로 둔다 — 고를 것이 없는데 고르라고 하지 않는다.",
  "- 제출 서류(파일 업로드)는 kind 를 file 로 둔다.",
  "- 동의·확인 체크는 checkbox. 긴 서술(자기소개, 사업 내용)은 long.",
  "- why 는 공고의 어느 대목 때문에 묻는지 한 문장.",
  "- 입력 칸이 아닌 것은 버린다: 섹션 제목(기본 정보, 제출 서류), 예시 값(010-0000-0000, https://…), 안내 문장.",
];

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
  /** 공고가 지정한 서식 파일 이름 */
  formName?: string | null;
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
    ...(input.formName?.trim() ? { formName: input.formName.trim() } : {}),
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
