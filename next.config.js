/** @type {import('next').NextConfig} */
const nextConfig = {
  optimizeFonts: false,
  experimental: {
    serverComponentsExternalPackages: [
      'pdf-parse',
      'mammoth',
      'officeparser',
      'node-edge-tts',
      'ws',
    ],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      dns: false,
    };
    return config;
  },
};

module.exports = nextConfig;
