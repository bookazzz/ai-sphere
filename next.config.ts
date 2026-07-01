import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  turbopack: {
    // Disable Turbopack for build — use webpack
  },
  // Force webpack for build
};

export default nextConfig;
