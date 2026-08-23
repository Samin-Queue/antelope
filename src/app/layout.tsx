import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { socialMetadata } from "@/lib/og";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { site } from "@/content/site";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  // 구글 OAuth 심사가 동의 화면의 앱 이름과 홈페이지의 앱 이름을 맞춰 본다.
  applicationName: site.name,
  // og:* 와 twitter:* 는 한 자리에서 만든다. 공유 카드 이미지는 `public/og.png`.
  ...socialMetadata({
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
  }),
  alternates: { canonical: "/" },
  // Search Console 「URL 접두어」 속성 확인용.
  //
  // ⚠ 이것으로 구글 OAuth 브랜딩 심사는 통과하지 못한다. 심사는 「도메인」 속성만
  //   보고, 도메인 속성은 DNS TXT 검증만 지원한다 — 메타 태그는 URL 접두어 전용이다.
  //   `antelope.up.railway.app` 은 Railway 소유라 TXT 를 못 넣으므로 커스텀 도메인이
  //   필요하다. AGENTS.md 「브랜딩 심사」 참고. 색인 목적으로는 유효해서 남긴다.
  verification: { google: "-XuSTupyONbotnbKrenTkRoKK9vVnCZeY23defiTpeo" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
