import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['pino', 'pino-pretty', 'opencc-js'],
  typedRoutes: true,
};

export default nextConfig;
