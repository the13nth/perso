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
};

export default nextConfig; 