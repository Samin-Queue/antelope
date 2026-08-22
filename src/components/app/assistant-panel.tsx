"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { ProviderMark } from "@/components/app/provider-mark";
import { ChatPanel } from "@/components/chat-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { readScreen } from "./screen-context";

/**
 * 어시스턴트 — 앱 셸의 **오른쪽 열**.
 *
 * 팝오버가 아니라 열이다. 본문을 덮으면 「화면을 보면서 묻는다」는 용도가
 * 사라지므로, 열리면 본문이 그만큼 좁아진다. 좁은 화면은 예외다 — 22rem 을
 * 나눠 가지면 둘 다 못 쓰니 거기서만 덮는다.
 *
 * 왼쪽 사이드바의 `SidebarProvider` 상태를 빌려 쓰지 않는다. 그쪽은 지금
 * `collapsible="none"` 이라 상태가 비어 있지만, 언젠가 접히게 되는 날
 * ⌘B 하나가 두 패널을 같이 흔든다.
 */
const ASSISTANT_COOKIE = "assistant_state";
const ASSISTANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** 도구가 도는 동안 화면에 뜨는 말. 이름을 그대로 노출하지 않는다 */
const TOOL_LABELS: Record<string, string> = {
  search_knowledge: "지식 베이스",
  list_knowledge: "지식 베이스 전체",
  list_goals: "지난 목표",
  get_goal: "목표 준비 내용",
};

const SUGGESTIONS = [
  "이 제품으로 뭘 할 수 있어?",
  "지원 사업 신청은 어디서 시작해?",
  "내 지식 베이스에 뭐가 들어 있어?",
  "지난 목표 어디까지 갔어?",
] as const;

/** 무엇이 답하는지. 서버가 실제 설정에서 읽어 넘긴다 */
export type AssistantModel = { provider: string; id: string };

type AssistantContextValue = {
  model: AssistantModel | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /**
   * 본문 화면을 같이 보낼 것인가.
   *
   * **기억하지 않는다.** 켠 채로 잊으면 그 뒤 모든 질문에 지금 보고 있는 것이
   * 통째로 실려 나간다 — 매번 새로 켜는 쪽이 맞다.
   */
  useScreen: boolean;
  setUseScreen: (value: boolean) => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

function useAssistant(): AssistantContextValue {
  const context = useContext(AssistantContext);
  if (!context) throw new Error("AssistantProvider 안에서만 쓸 수 있다.");
  return context;
}

export function AssistantProvider({
  model = null,
  defaultOpen = false,
  children,
}: {
  model?: AssistantModel | null;
  /** 서버가 쿠키에서 읽어 넘긴다. 새로고침해도 열려 있던 대로 뜬다 */
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpenState] = useState(defaultOpen);
  const [useScreen, setUseScreen] = useState(false);

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value);
    document.cookie = `${ASSISTANT_COOKIE}=${value}; path=/; max-age=${ASSISTANT_COOKIE_MAX_AGE}`;
  }, []);

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  const value = useMemo(
    () => ({ model, open, setOpen, toggle, useScreen, setUseScreen }),
    [model, open, setOpen, toggle, useScreen, setUseScreen],
  );

  return <AssistantContext value={value}>{children}</AssistantContext>;
}

/**
 * 헤더 오른쪽 끝. **이름을 달고 있다** — 아이콘만 있던 자리에서는 눌러 보기
 * 전에는 무엇이 열리는지 알 수 없었다. 여는 곳과 닫는 곳이 같은 버튼이라
 * 패널 안에는 닫기 버튼을 따로 두지 않는다.
 */
export function AssistantToggle() {
  const { model, open, setOpen } = useAssistant();

  // 열려 있으면 여기서 사라진다. 닫기는 패널 자기 머리에 있다 — 같은 동작을
  // 두 군데 두면 어느 쪽이 무엇을 닫는지 매번 확인해야 한다.
  if (open) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setOpen(true)}
      aria-expanded={false}
      aria-controls="assistant-panel"
    >
      <ProviderMark provider={model?.provider ?? ""} />
      어시스턴트 열기
    </Button>
  );
}

export function AssistantSidebar() {
  const { model, open, setOpen, useScreen, setUseScreen } = useAssistant();
  // 「이 화면」이 무엇인지 모델이 알아야 한다. 전송 시점의 경로를 실어 보낸다.
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <aside
      id="assistant-panel"
      // 닫혔을 때 폭 0 안쪽으로 포커스가 새지 않게 흐름에서 통째로 뺀다.
      inert={!open}
      aria-hidden={!open}
      className={cn(
        "sticky top-0 z-30 flex h-svh shrink-0 flex-col overflow-hidden bg-sidebar",
        "transition-[width] duration-200 ease-linear",
        // 좁은 화면에서는 본문 옆이 아니라 위로 덮는다
        "max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-50",
        open
          ? "w-[22rem] border-l border-border/60 max-md:w-[min(22rem,100vw)] max-md:shadow-xl"
          : "w-0",
      )}
    >
      {/* 폭이 줄어드는 동안 안쪽 글자가 같이 찌그러지지 않게 폭을 고정한다 */}
      <div className="flex h-full w-[22rem] max-w-[100vw] flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-4">
          {model && <ProviderMark provider={model.provider} />}
          <span className="text-sm font-medium">어시스턴트</span>
          {model && (
            // 고정 라벨을 박지 않는다 — 환경변수로 트랙을 갈면 이 글자도 따라간다.
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {model.id}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setOpen(false)}
          >
            닫기
          </Button>
        </header>
        <div className="min-h-0 flex-1 p-3">
          <ChatPanel
            api="/api/assistant"
            emptyMedia={
              model ? (
                <ProviderMark provider={model.provider} className="h-5" />
              ) : undefined
            }
            emptyTitle="무엇이든 물어보세요"
            empty="지식 베이스와 지난 목표를 직접 열어 보고 답합니다."
            placeholder="어시스턴트에게 물어보기"
            suggestions={SUGGESTIONS}
            // 경로만으로는 「이 칸에 뭘 넣지?」에 답할 수 없다. 켜져 있으면
            // 본문에 실제로 보이는 것을 전송 시점에 읽어 같이 보낸다.
            body={() => ({ path: pathname, screen: useScreen ? readScreen() : null })}
            /*
              화면 내용은 **매번 보내지 않는다.** 요청마다 수천 자가 붙고 거기에는
              사용자가 지금 보고 있는 것이 전부 실린다 — 무엇이 같이 가는지는
              보내는 자리에 붙어 있어야 보인다.
            */
            composerAddon={
              <Label
                htmlFor="assistant-screen"
                className="gap-2 text-xs font-normal text-muted-foreground"
                title="켜면 지금 보고 있는 화면의 글과 입력 칸을 같이 보냅니다"
              >
                <Switch
                  id="assistant-screen"
                  size="sm"
                  checked={useScreen}
                  onCheckedChange={setUseScreen}
                />
                현재 화면 참고
              </Label>
            }
            toolLabels={TOOL_LABELS}
          />
        </div>
      </div>
    </aside>
  );
}
