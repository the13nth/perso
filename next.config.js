const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbotrace: {
      enabled: true,
    },
  },
  // Enable SWC minification
  swcMinify: true,
  // Configure build output
  output: 'standalone',
  // Enable build cache
  cache: true,
  // Configure image domains if needed
  images: {
    domains: [],
  },
}

module.exports = withBundleAnalyzer(nextConfig)