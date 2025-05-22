import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
  },
  serverExternalPackages: ['styled-jsx', 'pdf-parse'],
  output: 'standalone',
  distDir: '.next',
  images: {
    domains: [],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs' module on the client to prevent this error
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Ensure pdf-parse is bundled correctly for the server
    if (isServer) {
      config.externals = [...config.externals, 'canvas', 'pdf-parse'];
    }
    
    return config;
  },
};

export default bundleAnalyzer(nextConfig); 