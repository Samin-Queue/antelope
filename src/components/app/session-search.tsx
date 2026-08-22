"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Astroid,
  BookUser,
  CalendarDays,
  RotateCcwClock,
  Search,
  Settings,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type SearchSession = { id: string; title: string; organization: string | null };

/**
 * ⌘K.
 *
 * 세션이 쌓이면 사이드바 목록만으로는 못 찾는다. 지금은 제목·기관과 화면
 * 이름까지만 훑고, 나중에 세션 안의 내용까지 넓힌다.
 */
const PAGES = [
  { href: "/app", label: "세션 시작하기", icon: Astroid },
  { href: "/app/sessions", label: "모든 세션", icon: RotateCcwClock },
  { href: "/app/hub", label: "데이터 허브", icon: BookUser },
  { href: "/app/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/app/settings", label: "설정 · 연동", icon: Settings },
];

export function SessionSearch({ sessions }: { sessions: SearchSession[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen((prev) => !prev);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="검색"
        className="flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <Search className="size-4 shrink-0" />
        <span>검색</span>
        <kbd className="ml-auto font-mono text-[10px] tracking-widest opacity-60">⌘K</kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="검색"
        description="세션과 화면을 찾는다"
      >
        <CommandInput placeholder="세션 제목, 기관, 화면 이름" />
        <CommandList>
          <CommandEmpty>결과가 없다.</CommandEmpty>
          {sessions.length > 0 && (
            <CommandGroup heading="세션">
              {sessions.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.organization ?? ""}`}
                  onSelect={() => go(`/app/sessions/${item.id}`)}
                >
                  <RotateCcwClock />
                  <span className="truncate">{item.title}</span>
                  {item.organization && (
                    <span className="ml-auto truncate text-xs text-muted-foreground">
                      {item.organization}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="이동">
            {PAGES.map((page) => (
              <CommandItem
                key={page.href}
                value={page.label}
                onSelect={() => go(page.href)}
              >
                <page.icon />
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
