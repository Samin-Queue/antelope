import { z } from "zod";

/**
 * 필드 계약 — zod 스키마에서 프롬프트 문장을 만든다.
 *
 * Upstage 는 `response_format: json_object` 만 받고 **스키마를 모델에 넘기지
 * 않는다.** 그래서 계약을 프롬프트에 직접 박아야 하는데(AGENTS.md 「구조화
 * 출력의 함정」), 그 계약 문자열이 열두 곳에 손으로 복제돼 있었다 — 예컨대
 * `research.ts` 의 select/options 지시와 `reconcile.ts` 의 그것은 글자 하나
 * 안 틀리고 같다. 스키마를 고치고 문장을 안 고치면 모델은 옛 계약을 따른다.
 *
 * 여기서 파생하면 그 사고가 구조적으로 불가능해진다.
 */
type Json = Record<string, unknown>;

function unwrap(node: Json): Json {
  // `.nullish()` 는 zod 4 가 `anyOf: [T, {type:"null"}]` 로 낸다. 계약 문장에는
  // `T | null` 로 쓰는 편이 짧고, 모델이 그 표기를 잘 따른다.
  const anyOf = node.anyOf as Json[] | undefined;
  if (!anyOf) return node;
  const real = anyOf.filter((item) => item.type !== "null");
  if (real.length === 1) return { ...real[0], __nullable: true };
  return node;
}

function render(node: Json, depth = 0): string {
  const shape = unwrap(node);
  const nullable = shape.__nullable ? " | null" : "";

  if (Array.isArray(shape.enum)) {
    return (shape.enum as unknown[]).map((v) => JSON.stringify(v)).join("|") + nullable;
  }
  if (shape.const !== undefined) return JSON.stringify(shape.const) + nullable;

  switch (shape.type) {
    case "object": {
      const props = (shape.properties ?? {}) as Record<string, Json>;
      const entries = Object.entries(props);
      if (entries.length === 0) return "object" + nullable;
      // 객체 세 겹을 넘기면 프롬프트가 스키마 덤프가 된다. 실제 스키마는 다 얕다.
      const inner = entries
        .map(([key, value]) => `"${key}": ${depth >= 3 ? "…" : render(value, depth + 1)}`)
        .join(", ");
      return `{ ${inner} }` + nullable;
    }
    // ⚠ 배열은 **깊이를 소비하지 않는다.** 중첩 레벨이 아니라 컨테이너다.
    // 여기서 depth 를 올리면 `{ "needs": [{ "label": …, … }] }` 처럼 정작
    // 계약이 필요한 원소 필드가 통째로 생략된다.
    case "array":
      return `[${render((shape.items ?? {}) as Json, depth)}]` + nullable;
    case "integer":
      return "number" + nullable;
    default:
      return String(shape.type ?? "any") + nullable;
  }
}

/**
 * 이 스키마를 프롬프트에 박을 한 줄로.
 *
 * `io: "output"` 이라야 `.transform()` 뒤의 모양이 아니라 **모델이 내야 하는**
 * 모양이 나온다.
 */
export function contractOf(schema: z.ZodType): string {
  const json = z.toJSONSchema(schema, {
    io: "output",
    unrepresentable: "any",
  }) as Json;
  return render(json);
}

/**
 * system 프롬프트를 조립한다.
 *
 * 「json」이라는 낱말이 **반드시** 들어간다 — `response_format: json_object` 를
 * 쓸 때 Upstage 가 요구하고, 없으면 요청 자체를 거부한다. 사람이 기억해서 넣던
 * 것을 구조로 바꾼다.
 */
export function systemFor(opts: {
  role: string;
  schema: z.ZodType;
  rules?: string[];
}): string {
  return [
    opts.role,
    "결과를 아래 JSON 구조 그대로 낸다. 키 이름을 바꾸거나 새로 만들지 않는다.",
    contractOf(opts.schema),
    ...(opts.rules?.length ? ["", "규칙:", ...opts.rules] : []),
  ].join("\n");
}
