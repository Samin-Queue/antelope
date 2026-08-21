import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Docker 런타임 이미지를 얇게 유지 (.next/standalone) */
  output: "standalone",
  /**
   * Playwright 는 네이티브 모듈과 async_hooks 에 의존해 번들링할 수 없다.
   * 서버에서 require 로 그대로 불러오게 둔다.
   */
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
