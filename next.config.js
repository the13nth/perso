import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
  },
  serverExternalPackages: ['styled-jsx'],
  output: 'standalone',
  distDir: '.next',
  images: {
    domains: [],
  },
};

export default bundleAnalyzer(nextConfig); 