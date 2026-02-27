import type { NextConfig } from "next";

const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Restrict build workers to prevent OOM / freezing on low-resource VPS
    cpus: 1,
    workerThreads: false,
  },
} as NextConfig;

export default nextConfig;
