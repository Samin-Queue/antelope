"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  // 아이콘 전환을 CSS 로 처리한다 — 서버가 모르는 값을 렌더하지 않으므로
  // mounted 플래그 없이도 하이드레이션이 어긋나지 않는다.
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
      aria-label="테마 전환"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  );
}
