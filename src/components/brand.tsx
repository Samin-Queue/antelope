import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * 로고는 다크/라이트 두 벌이 있다. `-on-dark` 는 흰색이라 어두운 배경용,
 * `-on-light` 는 검정이라 밝은 배경용이다. CSS 로 전환한다.
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

export function Combination({ className, priority }: LogoProps) {
  return (
    <>
      <Image
        src="/brand/combination-on-light.svg"
        alt="Antelope"
        width={140}
        height={32}
        priority={priority}
        className={cn("dark:hidden", className)}
      />
      <Image
        src="/brand/combination-on-dark.svg"
        alt="Antelope"
        width={140}
        height={32}
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
