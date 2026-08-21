import type { ComposerSubmit } from "@/components/app/composer";

/**
 * 랜딩 히어로에서 받은 입력을 워크스페이스로 넘긴다.
 *
 * 랜딩은 아무것도 전송하지 않는다. 입력을 여기 맡겨두고 `/app` 으로 보내면
 * 워크스페이스가 꺼내 그대로 세션을 시작한다.
 *
 * 두 벌로 보관하는 이유:
 *   - 모듈 변수 — 소프트 내비게이션(`router.push`)에서는 파일까지 그대로 넘어간다
 *   - sessionStorage — OAuth 왕복은 전체 새로고침이라 모듈 변수가 날아간다.
 *     File 은 직렬화가 안 되므로 텍스트·링크만 살아남는다
 */
const KEY = "antelope:pending-input";

/**
 * 꺼낸 값을 잠깐 더 들고 있는 시간.
 *
 * ⚠ 개발 모드의 StrictMode 는 마운트를 두 번 한다. 첫 마운트가 값을 가져가고
 * 통째로 버려지면 진짜 마운트에는 아무것도 안 남아 입력이 사라진다(실제로 겪었다).
 * 같은 틱의 재호출에는 같은 값을 돌려주고, 그 뒤 방문에는 남기지 않는다.
 */
const ECHO_MS = 1000;

let held: ComposerSubmit | null = null;
let echo: ComposerSubmit | null = null;
let echoTimer: ReturnType<typeof setTimeout> | undefined;

function readStorage(): ComposerSubmit | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "kind" in parsed) {
      const kind = (parsed as { kind: unknown }).kind;
      if (kind === "text" || kind === "url") return parsed as ComposerSubmit;
    }
    return null;
  } catch {
    return null;
  }
}

function clearStorage(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 사파리 프라이빗 모드 등에서 던진다. 모듈 변수 경로는 여전히 산다.
  }
}

export function setPendingInput(input: ComposerSubmit): void {
  held = input;
  if (input.kind === "file") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(input));
  } catch {
    // 위와 같다 — 저장이 막혀도 소프트 내비게이션은 모듈 변수로 넘어간다.
  }
}

export function takePendingInput(): ComposerSubmit | null {
  const found = held ?? readStorage();
  held = null;
  clearStorage();

  if (!found) return echo;

  echo = found;
  clearTimeout(echoTimer);
  echoTimer = setTimeout(() => {
    echo = null;
  }, ECHO_MS);
  return found;
}
