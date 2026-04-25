import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['pino', 'pino-pretty', 'opencc-js'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
