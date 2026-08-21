"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** 제품 컨셉이 다크다. 시스템 설정을 따르지 않고 다크를 기본으로 둔다. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
