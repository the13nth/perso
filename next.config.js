/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@firebase/firestore', 'styled-jsx', 'pdf-parse'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  api: {
    responseLimit: '8mb',
    bodyParser: {
      sizeLimit: '8mb',
    },
    externalResolver: true,
    timeout: 60000,
  }
};

export default nextConfig; 