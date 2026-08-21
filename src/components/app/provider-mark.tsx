import Image from "next/image";
import { Sparkles } from "lucide-react";

/**
 * 프로바이더 마크.
 *
 * 로고 파일은 `public/brand/providers/<provider>.svg` 에 둔다.
 * 없으면 중립 아이콘으로 떨어진다 — 기억으로 남의 로고를 그리지 않는다.
 */
const KNOWN = new Set(["upstage", "azure", "openai"]);

export function ProviderMark({
  provider,
  className = "size-3.5",
}: {
  provider: string;
  className?: string;
}) {
  if (!KNOWN.has(provider)) return <Sparkles className={className} />;
  return (
    <Image
      src={`/brand/providers/${provider}.svg`}
      alt={provider}
      width={14}
      height={14}
      className={className}
    />
  );
}
