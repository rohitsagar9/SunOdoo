import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  experimental: {
    optimizePackageImports: ['lucide-react', '@mantine/core', '@mantine/hooks'],
  },
};

export default nextConfig;
