import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ['lucide-react', 'zustand', 'framer-motion'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, '../src'),
    };
    return config;
  },
  env: {
    NEXT_PUBLIC_ADAPTER: 'web',
  }
};

export default nextConfig;
