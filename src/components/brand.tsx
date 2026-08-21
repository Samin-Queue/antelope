import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * 로고는 다크/라이트 두 벌이 있다. `-on-dark` 는 어두운 배경용,
 * `-on-light` 는 밝은 배경용이고 CSS 로 전환한다.
 * 콤비네이션은 여기에 한 축이 더 있다 — 심볼이 브랜드 퍼플인 `Combination` 과
 * 전부 단색인 `CombinationMono`.
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

/**
 * 내비바·사이드바 상단처럼 브랜드를 처음 만나는 자리에만 쓴다.
 * 퍼플 심볼은 **다크에서만** — 라이트에서는 단색 검정이 그대로다.
 */
export function Combination({ className, priority }: LogoProps) {
  return (
    <>
      <Image
        src="/brand/combination-mono-on-light.svg"
        alt="Antelope"
        width={150}
        height={42}
        priority={priority}
        className={cn("dark:hidden", className)}
      />
      <Image
        src="/brand/combination-on-dark.svg"
        alt="Antelope"
        width={150}
        height={42}
        priority={priority}
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}

/** 단색 콤비네이션. 로고가 주인공이 아닌 자리(푸터·로그인)의 기본값이다. */
export function CombinationMono({ className, priority }: LogoProps) {
  return (
    <>
      <Image
        src="/brand/combination-mono-on-light.svg"
        alt="Antelope"
        width={150}
        height={42}
        priority={priority}
        className={cn("dark:hidden", className)}
      />
      <Image
        src="/brand/combination-mono-on-dark.svg"
        alt="Antelope"
        width={150}
        height={42}
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
