/** @type {import('next').NextConfig} */
const path = require('path');

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const monorepoRoot = path.join(__dirname, '../..');

const nextConfig = {
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  experimental: {
    serverComponentsExternalPackages: ['thirdweb', 'ethers']
  },
  webpack: (config, { isServer }) => {
    config.resolve.modules = [
      path.join(__dirname, 'node_modules'),
      path.join(monorepoRoot, 'node_modules'),
      ...(config.resolve.modules ?? []),
      'node_modules'
    ];

    if (isServer) {
      const externals = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean);
      externals.push('thirdweb', 'ethers');
      config.externals = externals;
    }

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
      },
      {
        protocol: 'https',
        hostname: 'www.google.com',
        pathname: '/s2/favicons/**'
      },
      {
        protocol: 'https',
        hostname: 'ugdmfewgxohbwggdiahp.supabase.co',
        pathname: '/storage/v1/object/public/**'
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
