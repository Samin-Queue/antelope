import Image from "next/image";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 프로바이더 마크.
 *
 * 로고 파일은 `public/brand/providers/<provider>.svg` 에 둔다.
 * 없으면 중립 아이콘으로 떨어진다 — 기억으로 남의 로고를 그리지 않는다.
 *
 * 마크마다 종횡비가 다르다. 높이를 기준으로 맞추고 너비는 비율대로 둔다.
 */
const MARKS: Record<string, { width: number; height: number }> = {
  upstage: { width: 137, height: 163 },
};

export function ProviderMark({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  const mark = MARKS[provider];
  if (!mark) return <Sparkles className={cn("size-3.5", className)} />;

  return (
    <Image
      src={`/brand/providers/${provider}.svg`}
      alt={provider}
      width={mark.width}
      height={mark.height}
      className={cn("h-3.5 w-auto", className)}
    />
  );
}
