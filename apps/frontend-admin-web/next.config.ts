import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: '/admin',
  transpilePackages: ['@petwell/shared-types']
};

export default nextConfig;
