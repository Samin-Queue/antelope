import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
  openGraph: {
    title: `${site.name} · ${site.tagline}`,
    siteName: site.name,
    description: site.description,
    url: site.url,
    locale: "ko_KR",
    type: "website",
  },
  alternates: { canonical: "/" },
  // Search Console 소유권 확인용. 구글이 홈페이지 소유자를 여기서 대조한다 —
  // `antelope.up.railway.app` 은 Railway 소유 도메인이라 DNS TXT 는 못 넣는다.
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
