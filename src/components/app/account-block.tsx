"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleUserRound, LogOut, MoreHorizontal, Settings } from "lucide-react";

import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type AccountUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/** 사이드바 맨 아래. 누구로 로그인해 있는지가 항상 보여야 한다. */
export function AccountBlock({
  user,
  className,
}: {
  user: AccountUser | null;
  className?: string;
}) {
  const router = useRouter();

  if (!user) {
    return (
      <div className={cn("px-1 pb-1", className)}>
        <Button
          render={<Link href="/sign-in" />}
          size="sm"
          className="w-full group-data-[collapsible=icon]:hidden"
        >
          로그인
        </Button>
        <Link
          href="/sign-in"
          aria-label="로그인"
          className="mx-auto hidden size-8 items-center justify-center rounded-md group-data-[collapsible=icon]:flex hover:bg-sidebar-accent"
        >
          <CircleUserRound className="size-4" />
        </Link>
      </div>
    );
  }

  const label = user.name || user.email || "사용자";
  const avatar = (
    <Avatar className="size-7 shrink-0 rounded-md">
      {user.image ? <AvatarImage src={user.image} alt={label} /> : null}
      <AvatarFallback className="rounded-md text-xs">
        {label.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );

  const menu = (
    <DropdownMenuContent align="end" side="right" sideOffset={8} className="w-60">
      {/* GroupLabel 은 Group 안에서만 산다. 밖에 두면 base-ui 가
          "MenuGroupContext is missing" 로 렌더 자체를 던진다. */}
      <DropdownMenuGroup>
        <DropdownMenuLabel className="flex items-center gap-2">
          {avatar}
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{label}</span>
            {user.email && (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            )}
          </span>
        </DropdownMenuLabel>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem render={<Link href="/app/settings" />}>
          <Settings />
          설정 · 연동
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => signOut({ fetchOptions: { onSuccess: () => router.refresh() } })}
      >
        <LogOut />
        로그아웃
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  return (
    <div className={cn("px-1 pb-1", className)}>
      {/* 펼친 상태 — 행 전체가 트리거다. 호버 효과는 행 전체에 걸리는데 클릭이
          「…」 에서만 먹으면, 눌러도 안 열리는 자리가 생긴다. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="계정 메뉴"
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
            >
              {avatar}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{label}</span>
                {user.email && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                )}
              </span>
              <MoreHorizontal className="size-4 shrink-0 text-muted-foreground" />
            </button>
          }
        />
        {menu}
      </DropdownMenu>
    </div>
  );
}
