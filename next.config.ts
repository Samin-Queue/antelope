import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Docker 런타임 이미지를 얇게 유지 (.next/standalone) */
  output: "standalone",
};

export default nextConfig;
