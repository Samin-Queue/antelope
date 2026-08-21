"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  FlaskConical,
  LayoutDashboard,
  MessagesSquare,
  Sparkles,
  TestTubeDiagonal,
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
  SidebarRail,
} from "@/components/ui/sidebar";

const SECTIONS = [
  {
    label: "워크스페이스",
    items: [
      { href: "/app", label: "워크스페이스", icon: LayoutDashboard },
      { href: "/app/notices", label: "공고", icon: Sparkles },
      { href: "/app/documents", label: "문서", icon: FileText },
    ],
  },
  {
    label: "도구",
    items: [
      { href: "/app/playground", label: "플레이그라운드", icon: MessagesSquare },
      { href: "/app/test", label: "테스트", icon: TestTubeDiagonal },
      { href: "/lab", label: "실험", icon: FlaskConical },
    ],
  },
];

export function AppSidebar({ footer }: { footer?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-3">
        <Link href="/app" aria-label="Antelope 홈">
          <Combination priority className="h-7 w-auto" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/app" && pathname.startsWith(item.href));
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
