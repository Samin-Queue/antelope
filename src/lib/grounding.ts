import type { Citation, ParsedElement, Quad } from "@/lib/upstage-studio";

/**
 * 근거 — 「이 값 어디서 나왔어?」에 답하는 최소 단위.
 *
 * Studio parse 가 요소마다 정규화 좌표를 주므로 화면에 그대로 그릴 수 있다.
 * 좌표를 우리가 추정하지 않는 것이 요점이다 — 추정한 하이라이트는 근거가 아니다.
 *
 * ⚠ 런타임 의존성이 없다. 클라이언트 컴포넌트가 그대로 import 한다.
 *
 * 이 파일은 `lab/notice/_lib/evidence.ts` 에서 자랐지만 프로덕션(`app/start`)이
 * 읽어야 해서 여기로 옮겼다. 실험 폴더를 지울 때 프로덕션이 같이 깨지면 안
 * 된다 — 「버릴 때는 폴더를 지우면 그게 전부」가 성립하려면 정본이 여기여야 한다.
 * 원 위치에는 re-export 만 남는다.
 */
export type Box = { x: number; y: number; w: number; h: number };

export type Evidence = {
  /** parse 요소 id. citation 의 node_index 와 같은 값이다 */
  id: number;
  page: number;
  category: string;
  text: string;
  box: Box;
};

function toBox(quad: Quad): Box {
  const xs = quad.map((point) => point.x);
  const ys = quad.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function toEvidence(elements: ParsedElement[]): Evidence[] {
  return elements.map((element) => ({
    id: element.id,
    page: element.page,
    category: element.category,
    text: (element.content.text ?? element.content.markdown ?? "").trim(),
    box: toBox(element.coordinates),
  }));
}

/** 문서 전체 쪽수. 요소가 없으면 0 이다. */
export function pageCount(evidence: Evidence[]): number {
  return evidence.reduce((max, item) => Math.max(max, item.page), 0);
}

/**
 * 비교용 정규화. 공백·구두점·괄호를 털어낸다.
 *
 * 추출 결과의 `source` 는 원문을 그대로 옮긴 것이지만 모델이 조사나 괄호를
 * 조금씩 다듬는다. 이 정도만 맞춰도 정확히 붙는다.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/【[^】]*】/g, "")
    .replace(/[\s.,·、。「」『』()[\]{}<>“”"'’‘\-–—:;!?]/g, "");
}

/** 문자 2-gram 집합. 짧은 문자열은 자기 자신 한 개로 둔다. */
function shingles(text: string): Set<string> {
  if (text.length < 2) return new Set(text ? [text] : []);
  const out = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) out.add(text.slice(i, i + 2));
  return out;
}

/** 질의가 대상에 얼마나 담겨 있는가. 부분집합이면 1 이다. */
function containment(query: Set<string>, target: Set<string>): number {
  if (query.size === 0) return 0;
  let hit = 0;
  for (const gram of query) if (target.has(gram)) hit++;
  return hit / query.size;
}

/**
 * 임계값 0.6.
 *
 * 실측(청년창업사관학교 공고, 요소 15개): 모델이 문장을 다듬어 완전 포함이
 * 깨진 경우 0.727, 같은 문서의 무관한 요소는 최고 0.176 이었다. 그 사이면
 * 어디를 잡아도 되지만, 낮추면 아무 문단이나 근거라고 우기게 된다.
 */
const THRESHOLD = 0.6;

export type Match = { evidence: Evidence; score: number };

/**
 * 값 하나의 근거를 찾는다. 완전 포함이 있으면 그것만, 없으면 유사한 것을 최대 2개.
 *
 * 못 찾으면 빈 배열이다 — 아무거나 골라 하이라이트하지 않는다. 화면은 이 경우
 * 「원문에서 찾지 못했다」고 말해야 한다.
 */
export function matchEvidence(evidence: Evidence[], needle: string): Match[] {
  for (const query of queries(needle)) {
    const exact = evidence.filter((item) => normalize(item.text).includes(query));
    if (exact.length > 0) {
      return exact.slice(0, 2).map((item) => ({ evidence: item, score: 1 }));
    }

    const grams = shingles(query);
    const near = evidence
      .map((item) => ({
        evidence: item,
        score: containment(grams, shingles(normalize(item.text))),
      }))
      .filter((match) => match.score >= THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    if (near.length > 0) return near;
  }
  return [];
}

/**
 * 찾아볼 문자열들. 앞에서부터 하나라도 걸리면 거기서 멈춘다.
 *
 * 날짜만 특별하다 — 추출 결과는 `2026-09-15` 로 정규화되는데 원문은
 * 「2026년 9월 15일」이라 글자로는 절대 안 만난다. 실제로 마감일 하나만
 * 근거를 못 찾았고, 사용자가 가장 확인하고 싶어 하는 값이 그것이었다.
 */
function queries(needle: string): string[] {
  const base = normalize(needle);
  /**
   * 너무 짧은 값은 찾지 않는다.
   *
   * `containment` 는 **질의 길이로만** 정규화한다 — 대상이 아무리 길어도
   * 질의의 2-gram 이 다 들어 있으면 1.0 이다. 「등본」 두 글자짜리 서류명은
   * 긴 문단에 우연히 담기고, 그러면 하이라이트가 근거인 척하는 장식이 된다.
   * 이 제품이 파는 게 정확히 그 신뢰라 문턱을 둔다.
   */
  if (base.length < 6) return [];

  const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(needle.trim());
  if (date) {
    const [, year, month, day] = date;
    const m = String(Number(month));
    const d = String(Number(day));
    return [
      base,
      normalize(`${year}년 ${m}월 ${d}일`),
      normalize(`${year}.${month}.${day}`),
      normalize(`${m}월 ${d}일`),
    ];
  }

  /**
   * 금액도 날짜와 같은 문제다. 추출 결과가 `50000000` 인데 원문은
   * 「5,000만원」·「5천만원」이라 글자로 안 만난다.
   */
  const amount = /^\d{4,}$/.exec(needle.replace(/[,\s원]/g, ""));
  if (amount) {
    const n = Number(amount[0]);
    const forms = [base, normalize(n.toLocaleString("ko-KR"))];
    if (n % 100_000_000 === 0) forms.push(normalize(`${n / 100_000_000}억`));
    if (n % 10_000 === 0)
      forms.push(normalize(`${(n / 10_000).toLocaleString("ko-KR")}만`));
    return [...new Set(forms)];
  }

  return [base];
}

/**
 * instruct 인용을 근거로 바꾼다. node_index 가 parse 요소 id 라 바로 이어붙는다.
 * 인용 좌표가 요소와 어긋나면 인용 쪽을 믿는다 — 그게 모델이 실제로 본 위치다.
 */
export function citedEvidence(evidence: Evidence[], citations: Citation[]): Evidence[] {
  return citations
    .map((citation) => {
      const found = evidence.find((item) => item.id === citation.node_index);
      if (!found) return null;
      return citation.coordinates?.length === 4
        ? { ...found, page: citation.page, box: toBox(citation.coordinates) }
        : found;
    })
    .filter((item): item is Evidence => item !== null);
}

/** 응답 본문에서 citations 를 안전하게 꺼낸다. 문자열로 오고 형태가 흔들린다. */
export function toCitations(raw: unknown): Citation[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is Citation =>
      typeof item === "object" && item !== null && "node_index" in item,
  );
}
