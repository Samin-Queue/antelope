"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Astroid,
  BookUser,
  CalendarDays,
  FileText,
  FlaskConical,
  Globe,
  House,
  MessagesSquare,
  RotateCcwClock,
  Settings,
  Sparkles,
} from "lucide-react";

import { Combination } from "@/components/brand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { AccountBlock, type AccountUser } from "./account-block";
import { SessionSearch, type SearchSession } from "./session-search";

/**
 * 앱 셸의 왼쪽.
 *
 * 위는 사용자가 하는 일(워크스페이스), 아래는 우리가 만든 것을 직접 찔러보는
 * 자리(도구)다. **동작하지 않는 화면은 넣지 않는다** — 데모 중에 누르면
 * 안 되는 메뉴가 있는 것이 메뉴가 없는 것보다 나쁘다.
 *
 * 그래서 빠진 것: `/app/test`(정적 더미) · `/lab/validation`·`/lab/analysis`
 * (각자 `UPSTAGE_*_AGENT_ID` 가 있어야 돌아간다. 없으면 503).
 */
/** 「세션 시작하기」와 「모든 세션」은 따로 그린다 — 앞은 버튼, 뒤는 하위 목록을 단다. */
const WORKSPACE = [
  { href: "/app/hub", label: "데이터 허브", icon: BookUser },
  { href: "/app/calendar", label: "캘린더", icon: CalendarDays },
] as const;

const TOOLS = [
  { href: "/app/notices", label: "공고 분석", icon: Sparkles },
  { href: "/app/documents", label: "문서 파이프라인", icon: FileText },
  { href: "/app/playground", label: "플레이그라운드", icon: MessagesSquare },
  { href: "/demo", label: "데모 공고 사이트", icon: Globe },
  { href: "/lab", label: "실험", icon: FlaskConical },
] as const;

/** 사이드바에 직접 늘어놓는 세션 수. 나머지는 「모든 세션」에서 본다. */
const SIDEBAR_SESSIONS = 8;

export function AppSidebar({
  sessions,
  user,
}: {
  /** 사이드바에 펼쳐 보일 지난 세션. 서버에서 이미 정렬해 내려온다 */
  sessions: SearchSession[];
  user: AccountUser | null;
}) {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="none"
      // ⚠ `collapsible="none"` 은 평범한 div 로 렌더된다 — 문서 흐름에 있어서
      // 본문을 스크롤하면 사이드바도 같이 밀려 올라간다. sticky 로 붙인다.
      className="sticky top-0 h-svh shrink-0 overflow-y-auto border-r border-sidebar-border"
    >
      <SidebarHeader className="h-14 justify-center px-3">
        <div className="flex items-center gap-1">
          <Link href="/app" aria-label="워크스페이스" className="min-w-0 pl-1">
            <Combination priority className="h-6 w-auto" />
          </Link>
          {/* 앱과 랜딩은 셸이 달라 앱 안에서는 랜딩으로 돌아갈 길이 없다.
              아이콘만으로는 어디로 가는지 안 보여 툴팁을 단다. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/"
                  aria-label="홈페이지로 이동"
                  className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                >
                  <House className="size-4" />
                </Link>
              }
            />
            <TooltipContent side="bottom">홈페이지로 이동</TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pb-0">
          <SidebarGroupContent>
            <SessionSearch sessions={sessions} />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 라벨 없음. 이 그룹은 이 제품에서 하는 일 전부라 이름을 붙일 대상이
            아니다 — 아래 「도구」가 그것과 구분되는 묶음이다. */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {/* 이 제품에서 사용자가 처음 누를 것. 나머지 메뉴와 같은 무게로
                  두면 어디서 시작하는지가 안 보인다 — 그래서 버튼이고, 사이드바에서
                  유일하게 브랜드색을 쓴다. 다른 메뉴에는 색이 없으니 여기만 보인다.

                  아이콘은 이따금 한 바퀴 돈다(`spin-whoosh`). 늘 도는 스피너는
                  「작업 중」으로 읽히므로 돌고 나서 쉰다. */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/app" />}
                  className="justify-center bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                >
                  <Astroid className="animate-spin-whoosh" />
                  <span className="font-medium">세션 시작하기</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {WORKSPACE.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* 맨 아래. 접지 않는다 — 지난 세션은 이 제품에서 가장 자주
                  되짚는 것이고, 한 번 더 눌러야 보이면 그만큼 덜 되짚게 된다. */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/app/sessions"}
                  render={<Link href="/app/sessions" />}
                >
                  <RotateCcwClock />
                  <span>모든 세션</span>
                  {sessions.length > SIDEBAR_SESSIONS && (
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {sessions.length}
                    </span>
                  )}
                </SidebarMenuButton>
                <SidebarMenuSub>
                  {sessions.length === 0 ? (
                    <li className="px-2 py-1.5 text-xs text-muted-foreground">
                      아직 세션이 없다
                    </li>
                  ) : (
                    sessions.slice(0, SIDEBAR_SESSIONS).map((item) => (
                      <SidebarMenuSubItem key={item.id}>
                        <SidebarMenuSubButton
                          isActive={pathname === `/app/sessions/${item.id}`}
                          render={<Link href={`/app/sessions/${item.id}`} />}
                        >
                          <span className="truncate">{item.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))
                  )}
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>개발자 도구</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {TOOLS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.startsWith("/app/settings")}
              render={<Link href="/app/settings" />}
            >
              <Settings />
              <span>설정</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <AccountBlock user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
