/**
 * 의미 검증 — 형식은 맞는데 내용이 틀린 값을 잡는다.
 *
 * 스키마는 「문자열인가」까지만 본다. 「2026년 9월 중」은 `deadline` 으로
 * 완벽한 문자열이고, 그대로 스냅샷·계획·기한 역산까지 흘러간다. 브라우저의
 * `checkValidity()` 에게 물어 케이스별 프롬프트를 없앤 것과 같은 발상을
 * 추출 단계로 옮긴 것이다 — **규칙으로 답할 수 있으면 모델에게 묻지 않는다.**
 *
 * `severity` 가 둘인 이유: 값 하나가 이상한 것(`drop`)과 결과 전체를 못 믿는
 * 것(`reject`)은 처방이 다르다. 전자는 그 값만 버리고, 후자만 다시 묻는다.
 */
export type Issue = {
  path: string;
  code: string;
  message: string;
  severity: "drop" | "reject";
};

export type Rule<T> = (value: T) => Issue[];

const at = (value: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
      value,
    );

/** 배열 경로(`needs[].label`)를 실제 값 목록으로 편다 */
function collect(value: unknown, path: string): Array<{ path: string; value: unknown }> {
  const cut = path.indexOf("[]");
  if (cut === -1) {
    const found = at(value, path);
    return found === undefined ? [] : [{ path, value: found }];
  }
  const head = path.slice(0, cut);
  const tail = path.slice(cut + 2).replace(/^\./, "");
  const list = at(value, head);
  if (!Array.isArray(list)) return [];
  return list.flatMap((item, index) =>
    tail
      ? collect(item, tail).map((hit) => ({ path: `${head}[${index}].${hit.path}`, value: hit.value }))
      : [{ path: `${head}[${index}]`, value: item }],
  );
}

/** `YYYY-MM-DD` 인가. 그리고 실제로 존재하는 날짜인가 */
export function isoDate<T>(path: string, opts: { future?: string } = {}): Rule<T> {
  return (value) =>
    collect(value, path).flatMap(({ path: where, value: raw }) => {
      if (raw === null || raw === undefined || raw === "") return [];
      const text = String(raw).trim();
      const shape = text.match(/^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2})?$/);
      if (!shape) {
        return [
          {
            path: where,
            code: "date-format",
            message: `"${text.slice(0, 40)}" 는 YYYY-MM-DD 가 아니다`,
            severity: "drop" as const,
          },
        ];
      }
      // `2026-02-31` 은 형식을 통과한다. 실제 달력에 있는지는 따로 본다.
      const [, y, m, d] = shape;
      const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
      if (date.getUTCMonth() + 1 !== Number(m) || date.getUTCDate() !== Number(d)) {
        return [
          {
            path: where,
            code: "date-invalid",
            message: `${text} 는 달력에 없는 날짜다`,
            severity: "drop" as const,
          },
        ];
      }
      if (opts.future && text.slice(0, 10) < opts.future) {
        return [
          {
            path: where,
            code: "date-past",
            message: `${text} 는 오늘(${opts.future}) 이전이다`,
            severity: "drop" as const,
          },
        ];
      }
      return [];
    });
}

/** 정해진 값 중 하나인가 */
export function oneOf<T>(path: string, allowed: readonly string[]): Rule<T> {
  return (value) =>
    collect(value, path).flatMap(({ path: where, value: raw }) => {
      if (raw === null || raw === undefined || raw === "") return [];
      return allowed.includes(String(raw))
        ? []
        : [
            {
              path: where,
              code: "not-allowed",
              message: `"${String(raw).slice(0, 40)}" 는 ${allowed.join("|")} 중에 없다`,
              severity: "drop" as const,
            },
          ];
    });
}

/**
 * 예시 값이 항목으로 올라온 것.
 *
 * 「010-0000-0000」을 항목으로 만들면 사용자에게 그걸 묻게 된다.
 * `needs.ts` 의 정규식을 규칙으로 승격한 것이다.
 */
const PLACEHOLDER = /^https?:\/\/|^[\d\s\-().+]{6,}$|^[\w.+-]+@[\w-]+\.[\w.]+$|^예\)|^예시/;

export function noPlaceholder<T>(path: string): Rule<T> {
  return (value) =>
    collect(value, path).flatMap(({ path: where, value: raw }) => {
      const text = String(raw ?? "").trim();
      if (!text || !PLACEHOLDER.test(text)) return [];
      return [
        {
          path: where,
          code: "placeholder",
          message: `"${text.slice(0, 40)}" 는 예시 값이지 항목이 아니다`,
          severity: "drop" as const,
        },
      ];
    });
}

/**
 * 라벨의 단위와 값의 자릿수가 맞는가.
 *
 * 「총사업비 (천원)」에 1억을 넣으려면 `100000` 이다. 이 한 줄을 위해
 * 브라우저 시스템 프롬프트에 규칙이 하나 붙어 있었다 — AGENTS.md 가 스스로
 * 금지한 「케이스마다 프롬프트」 증식이 여기서 멈춘다.
 */
const UNITS: Array<{ re: RegExp; scale: number; name: string }> = [
  { re: /\(?\s*천\s*원\s*\)?/, scale: 1_000, name: "천원" },
  { re: /\(?\s*백\s*만\s*원\s*\)?/, scale: 1_000_000, name: "백만원" },
  { re: /\(?\s*억\s*원\s*\)?/, scale: 100_000_000, name: "억원" },
];

export function unitMatch(label: string, raw: string): Issue[] {
  const unit = UNITS.find((u) => u.re.test(label));
  if (!unit) return [];
  const digits = raw.replace(/[,\s원]/g, "");
  if (!/^\d+$/.test(digits)) return [];
  // 라벨이 「천원」인데 값이 억 단위면 단위를 안 따른 것이다. 경계는 넉넉히.
  if (Number(digits) < unit.scale * 1_000) return [];
  return [
    {
      path: label,
      code: "unit",
      message: `「${label}」 는 ${unit.name} 단위다. ${digits} 는 그대로 넣기에 너무 크다`,
      severity: "drop",
    },
  ];
}

/**
 * 발급 서류를 「작성」으로 분류했는가.
 *
 * **이건 위조를 막는 자리다.** 사업자등록증을 우리가 써 주면 값 하나 틀린
 * 것과 급이 다르다 — 그래서 유일하게 `reject` 이고, 한 번 되묻는다. 목록은
 * 프롬프트에 이미 있는 것과 같은 것을 쓴다: 규칙과 문장이 갈리면 문장만
 * 고치는 사고가 난다.
 */
const OBTAIN_ONLY =
  /사업자등록|법인등기|등기부|주민등록|가족관계|재무제표|부가가치세|납세|완납|소득금액|4대\s*보험|보험\s*가입|건강보험|고용보험|졸업\s*증명|재학\s*증명|성적\s*증명|경력\s*증명|재직\s*증명|통장\s*사본|신분증|인감|공동인증|자격증|면허/;

export function obtainOnly<T>(path: string): Rule<T> {
  return (value) =>
    collect(value, path).flatMap(({ path: where, value: raw }) => {
      const text = String(raw ?? "").trim();
      if (!text || !OBTAIN_ONLY.test(text)) return [];
      return [
        {
          path: where,
          code: "forgery",
          message: `「${text.slice(0, 40)}」 는 기관에서 발급받는 서류다. 작성(author)이 아니라 발급(obtain)으로 옮긴다`,
          severity: "reject" as const,
        },
      ];
    });
}

/** 같은 것을 두 번 묻는가. 사용자가 가장 싫어하는 실패다 */
export function uniqueBy<T>(path: string, key: (item: unknown) => string): Rule<T> {
  return (value) => {
    const seen = new Map<string, string>();
    const issues: Issue[] = [];
    for (const hit of collect(value, path)) {
      const id = key(hit.value);
      if (!id) continue;
      const first = seen.get(id);
      if (first) {
        issues.push({
          path: hit.path,
          code: "duplicate",
          message: `${first} 와 같은 항목이다`,
          severity: "drop",
        });
      } else {
        seen.set(id, hit.path);
      }
    }
    return issues;
  };
}

export function runRules<T>(value: T, rules: Array<Rule<T>>): Issue[] {
  return rules.flatMap((rule) => rule(value));
}

/** 모델에게 되먹일 문장. 무엇이 왜 틀렸는지만 적는다 */
export function issuesForModel(issues: Issue[]): string {
  return [
    "직전 응답에 아래 문제가 있다. 그 값만 고쳐 **같은 JSON 구조로** 다시 낸다.",
    ...issues.map((issue) => `- ${issue.path}: ${issue.message}`),
  ].join("\n");
}
