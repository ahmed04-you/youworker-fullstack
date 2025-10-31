import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Allow connection to backend API in Docker network
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_INTERNAL_API_BASE_URL || 'http://api:8001'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
