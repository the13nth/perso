const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbotrace: {
      enabled: true,
    },
    serverComponentsExternalPackages: ['styled-jsx']
  },
  swcMinify: true,
  output: 'standalone',
  distDir: '.next',
  images: {
    domains: [],
  },
}

module.exports = withBundleAnalyzer(nextConfig)