import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * 로고는 다크/라이트 두 벌이다. `-on-dark` 는 어두운 배경용, `-on-light` 는
 * 밝은 배경용이고 CSS 로 전환한다.
 *
 * 예전에는 콤비네이션에 퍼플/모노 두 축이 더 있었다. 지금은 없다 — 자리마다
 * 다른 로고를 쓰면 같은 제품이 두 개로 보인다.
 */
type LogoProps = { className?: string; priority?: boolean };

export function Wordmark({ className, priority }: LogoProps) {
  return (
    <>
      <Image
        src="/brand/wordmark-on-light.svg"
        alt="Antelope"
        width={93}
        height={25}
        priority={priority}
        className={cn("dark:hidden", className)}
      />
      <Image
        src="/brand/wordmark-on-dark.svg"
        alt="Antelope"
        width={93}
        height={25}
        priority={priority}
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}

/** 심볼 + 워드마크. 브랜드를 드러내는 모든 자리에서 이것 하나를 쓴다. */
export function Combination({ className, priority }: LogoProps) {
  return (
    <>
      <Image
        src="/brand/combination-on-light.svg"
        alt="Antelope"
        width={152}
        height={36}
        priority={priority}
        className={cn("dark:hidden", className)}
      />
      <Image
        src="/brand/combination-on-dark.svg"
        alt="Antelope"
        width={152}
        height={36}
        priority={priority}
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}

/** 브랜드 컬러 배경이 포함된 앱 아이콘. 배경 위에서 항상 같은 모습이다. */
export function SymbolBadge({ className, priority }: LogoProps) {
  return (
    <Image
      src="/brand/symbol-badge.svg"
      alt="Antelope"
      width={42}
      height={42}
      priority={priority}
      className={className}
    />
  );
}

/**
 * 심볼만. **인라인 SVG 다** — `currentColor` 로 칠하려면 `<img>` 로는 안 된다.
 * 오케스트레이터 상태 표시가 색으로 상태를 말하므로 색이 바뀌어야 한다.
 * 원본은 `public/brand/symbol-mark.svg`.
 */
export function Symbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-8", className)}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.5 20.5C5.90815 19.604 4 15.5 4.5 12.5L11.6147 15.9658C11.0748 14.6749 10.1342 13.6436 7.5 12C3.42613 9.45817 2 3 3.69311 0C2.87285 2.08795 5.04798 7.36143 11 9.5C15.469 11.1057 16.9765 15.5736 18.1591 18.4336L32 23.3922L28 28.5C23.7347 28.2712 18.049 28.1569 14.8163 32H0L9.5 20.5ZM17 21C17.5523 21 18 21.4477 18 22V23C18 23.5523 17.5523 24 17 24C16.4477 24 16 23.5523 16 23V22C16 21.4477 16.4477 21 17 21Z"
        fill="currentColor"
      />
    </svg>
  );
}
