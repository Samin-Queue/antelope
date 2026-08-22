import Link from "next/link";

import { Combination } from "@/components/brand";
import { site } from "@/content/site";

/**
 * 서비스 소개 — 구글 OAuth 브랜딩 심사가 홈페이지에서 확인하는 세 가지.
 *
 * 1. 앱 이름 — 동의 화면에 적은 이름이 홈페이지에 **텍스트로** 보여야 한다.
 *    헤더·푸터 로고는 SVG 라 alt 속성뿐이고, 히어로의 「Antelope로」는 조사가
 *    붙어 정확히 일치하지 않는다. 그래서 여기 `<h2>` 가 맨 이름 하나만 낸다.
 * 2. 앱의 목적 — 무엇을 하는 서비스인지 한 단락으로.
 * 3. 구글 권한의 용도 — 스코프마다 어디에 쓰는지.
 *
 * 전부 서버 렌더링이다. 심사 크롤러가 JS 를 돌린다는 보장이 없으므로
 * 클라이언트 컴포넌트로 감싸지 않는다.
 */
export function About() {
  return (
    <section id="about" className="border-t border-border/60">
      <div className="mx-auto w-full max-w-4xl px-5 py-24">
        <p className="text-sm font-medium text-brand">{site.about.eyebrow}</p>

        <div className="mt-4 flex items-center gap-3">
          <Combination className="h-8 w-auto" />
        </div>

        {/* 이 글자가 OAuth 동의 화면의 앱 이름과 정확히 같아야 한다 */}
        <h2 className="mt-5 text-3xl font-semibold tracking-tight">{site.about.name}</h2>
        <p className="mt-1 text-muted-foreground">{site.tagline}</p>

        <p className="mt-6 leading-relaxed text-pretty">{site.about.purpose}</p>
        <p lang="en" className="mt-4 leading-relaxed text-pretty text-muted-foreground">
          {site.about.purposeEn}
        </p>

        <div className="mt-12 rounded-2xl border border-border bg-card/40 p-6 sm:p-8">
          <h3 className="text-lg font-semibold tracking-tight text-balance">
            {site.about.scopes.headline}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {site.about.scopes.sub}
          </p>
          <p lang="en" className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {site.about.scopes.subEn}
          </p>

          <ul className="mt-6 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
            {site.about.scopes.items.map((item) => (
              <li key={item.scope} className="bg-background p-5">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 font-mono text-xs break-all text-brand">
                  {item.scope}
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
                <p
                  lang="en"
                  className="mt-2 text-sm leading-relaxed text-muted-foreground"
                >
                  {item.bodyEn}
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            {site.about.scopes.note}
          </p>
          <p lang="en" className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {site.about.scopes.noteEn}
          </p>

          <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {site.about.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-brand underline underline-offset-4"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          {site.about.name} · {site.team} · {site.url}
        </p>
      </div>
    </section>
  );
}
