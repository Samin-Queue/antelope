import type { Metadata } from "next";

import { site } from "@/content/site";

/**
 * 공유 카드 이미지. `public/og.png` **한 장**을 og:image 와 twitter:image 가 같이 쓴다.
 *
 * 1200×630 은 슬랙·카카오톡·페이스북·X·링크드인이 공통으로 크게 그리는 비율이다.
 * 파일을 둘로 두지 않는 이유는 동기화가 조용히 깨지기 때문이다 — 한 쪽만 바꾸면
 * 플랫폼마다 다른 그림이 뜨고, 그 사실을 알아차릴 방법이 링크를 붙여 보는 것뿐이다.
 *
 * ⚠ 그림을 바꾸면 **파일명도 같이 바꾼다.** 각 플랫폼의 스크래퍼 캐시는 URL 로
 *   잡히므로 같은 이름으로 덮으면 며칠 동안 옛 그림이 계속 나간다.
 */
const image = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: `${site.name} — All-in-one Apply AI Agent`,
  type: "image/png",
} as const;

/**
 * 페이지 하나 분량의 OG · 트위터 카드.
 *
 * ⚠ **페이지가 `openGraph` 를 정의하면 레이아웃의 `openGraph` 는 통째로 대체된다.**
 *   얕은 병합이 아니다(Next 메타데이터 병합 규칙). 그래서 제목만 바꾸려고 한 줄
 *   적었을 뿐인데 이미지·siteName·locale 이 조용히 사라진다. 이 함수를 거치면
 *   그 사고가 구조적으로 안 난다 — 새 공개 페이지는 여기를 통해 붙인다.
 */
export function socialMetadata({
  title,
  description,
  path = "/",
  type = "website",
}: {
  title: string;
  description: string;
  /** 사이트 루트 기준 경로. `/` 면 canonical 과 같은 주소가 된다. */
  path?: string;
  type?: "website" | "article";
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      title,
      description,
      siteName: site.name,
      url: path === "/" ? site.url : `${site.url}${path}`,
      locale: "ko_KR",
      type,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
