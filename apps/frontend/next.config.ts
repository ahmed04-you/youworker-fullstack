import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Specify the project root to silence lockfile warning
  experimental: {
    turbo: {
      root: process.cwd(),
    },
  },

  // Use a different output directory to avoid permission issues
  distDir: '.next-dev',
};
