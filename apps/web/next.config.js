/** @type {import('next').NextConfig} */
const path = require('path');

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const monorepoRoot = path.join(__dirname, '../..');

const nextConfig = {
  output: 'standalone',
  webpack: (config) => {
    config.resolve.modules = [
      path.join(__dirname, 'node_modules'),
      path.join(monorepoRoot, 'node_modules'),
      ...(config.resolve.modules ?? []),
      'node_modules'
    ];
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
        pathname: '/**'
      }
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin}/api/v1/:path*`
      }
    ];
  }
};

module.exports = nextConfig;
