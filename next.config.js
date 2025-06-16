/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@firebase/firestore', 'styled-jsx', 'pdf-parse', '@pinecone-database/pinecone'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
      };
    }
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig; 