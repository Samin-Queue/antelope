import Link from "next/link";

import { legal, type LegalSection } from "@/content/legal";

/** 약관·방침 공통 조판. 본문은 `src/content/legal.ts` 한 곳에만 둔다. */
export function LegalDocument({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <article>
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{intro}</p>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <div className="flex gap-1.5">
            <dt>시행일</dt>
            <dd className="text-foreground">{legal.effectiveDate}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>운영</dt>
            <dd className="text-foreground">{legal.operator}</dd>
          </div>
        </dl>
      </header>

      <div className="mt-12 space-y-10">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-medium">{section.heading}</h2>
            <ul className="mt-3 space-y-2.5">
              {section.body.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-muted-foreground">
                  {linkify(line)}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section>
          <h2 className="text-base font-medium">문의</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            개인정보 열람·삭제 요청과 문의는 아래로 보내 주세요.{" "}
            <Link href={legal.contact} className="text-brand hover:underline">
              {legal.contact}
            </Link>
          </p>
        </section>
      </div>
    </article>
  );
}

/**
 * 본문에 박아 둔 URL 을 링크로 바꾼다.
 *
 * 구글 심사는 정책 URL 이 눌러지는지까지 본다. 본문을 마크다운으로 쓰면
 * 렌더러가 하나 더 붙으므로, 괄호 안 URL 만 가볍게 잡는다.
 */
function linkify(text: string): React.ReactNode {
  const parts = text.split(/(https?:\/\/[^\s)（）]+)/g);
  return parts.map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="break-all text-brand hover:underline"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}
