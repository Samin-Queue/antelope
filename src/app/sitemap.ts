import type { MetadataRoute } from "next";

import { site } from "@/content/site";

/**
 * 공개 문서 3개뿐이다. 로그인 뒤 화면과 실험은 넣지 않는다 —
 * `robots.ts` 에서 이미 막았고, 색인돼 봐야 빈 껍데기만 보인다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-22");
  return [
    { url: site.url, lastModified, priority: 1 },
    { url: `${site.url}/privacy`, lastModified, priority: 0.3 },
    { url: `${site.url}/terms`, lastModified, priority: 0.3 },
  ];
}
