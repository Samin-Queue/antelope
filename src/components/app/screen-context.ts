/**
 * 왼쪽 본문에 지금 무엇이 보이는가.
 *
 * 어시스턴트는 여태 경로(`/app/hub`)만 알았다. 그래서 「이 칸에 뭘 넣어야
 * 해?」에 답할 수 없었다 — 사용자가 보고 있는 것이 문장 하나도 넘어가지
 * 않았기 때문이다.
 *
 * **전송 시점에 읽는다.** 화면은 계속 바뀌므로 미리 담아 두면 이미 지난 것을
 * 보낸다. 서버로 보내는 값이니 상한을 건다 — 세션 상세 한 장이 수만 자다.
 */
const MAX_TEXT = 3_500;
const MAX_FIELDS = 40;
const MAX_FIELD_VALUE = 120;

export type ScreenContext = {
  text: string;
  truncated: boolean;
  fields: Array<{ label: string; value: string; required: boolean }>;
};

/** 입력칸 하나가 무엇을 묻는지. 브라우저가 이미 아는 순서대로 뒤진다. */
function labelOf(control: HTMLElement): string {
  const aria = control.getAttribute("aria-label");
  if (aria) return aria;

  const id = control.getAttribute("id");
  if (id) {
    const tied = document.querySelector<HTMLLabelElement>(
      `label[for="${CSS.escape(id)}"]`,
    );
    if (tied?.innerText.trim()) return tied.innerText.trim();
  }

  const wrapping = control.closest("label");
  if (wrapping?.innerText.trim()) return wrapping.innerText.trim();

  return (
    control.getAttribute("placeholder") ??
    control.getAttribute("name") ??
    ""
  ).trim();
}

/**
 * 본문 영역만 읽는다. 어시스턴트 패널 자신과 사이드바는 `main` 밖이라 저절로
 * 빠진다 — 제가 방금 한 말을 화면 내용으로 다시 읽으면 대화가 자기를 문다.
 */
export function readScreen(): ScreenContext | null {
  const main = document.querySelector<HTMLElement>('main[data-slot="sidebar-inset"]');
  if (!main) return null;

  const raw = (main.innerText ?? "").replace(/\n{3,}/g, "\n\n").trim();

  // `innerText` 는 입력값을 담지 않는다. 「이 칸이 비어 있다」가 이 기능의
  // 요점이라 컨트롤을 따로 훑는다.
  const fields: ScreenContext["fields"] = [];
  const controls = main.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input:not([type=hidden]):not([type=file]), textarea",
  );
  for (const control of controls) {
    if (fields.length >= MAX_FIELDS) break;
    const label = labelOf(control);
    if (!label) continue;
    fields.push({
      label: label.slice(0, 60),
      value: (control.value ?? "").slice(0, MAX_FIELD_VALUE),
      required: control.required,
    });
  }

  return {
    text: raw.slice(0, MAX_TEXT),
    truncated: raw.length > MAX_TEXT,
    fields,
  };
}
