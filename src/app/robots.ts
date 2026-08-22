import type { MetadataRoute } from "next";

import { site } from "@/content/site";

/**
 * 구글 OAuth 심사가 홈페이지와 약관·방침을 크롤러로 열어 본다.
 * `/` 를 막으면 소유권 확인용 메타 태그도 못 읽으니 공개 문서 경로는 열어 둔다.
 *
 * 반대로 워크스페이스·실험·데모는 색인될 이유가 없다. 특히 `/demo/*` 는
 * 브라우저 에이전트가 채우는 가짜 신청 폼이라 검색에 뜨면 오해를 부른다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app/", "/lab/", "/demo/", "/playground", "/documents"],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
