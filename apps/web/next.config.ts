import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@llameo/shared"],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
