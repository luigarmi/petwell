import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@petwell/shared-types']
};

export default nextConfig;
