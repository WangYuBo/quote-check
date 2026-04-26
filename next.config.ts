import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  serverExternalPackages: ['pino', 'pino-pretty', 'opencc-js'],
  typedRoutes: true,
};

export default nextConfig;
