/** @type {import('next').NextConfig} */
const path = require('path');

const RAILWAY_PRODUCTION_API = 'https://sanovaapi-production.up.railway.app';
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const apiOrigin =
  configuredApiUrl ||
  (process.env.VERCEL === '1' ? RAILWAY_PRODUCTION_API : 'http://localhost:4000');
const monorepoRoot = path.join(__dirname, '../..');

const nextConfig = {
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  staticPageGenerationTimeout: 180,
  experimental: {
    serverComponentsExternalPackages: ['thirdweb', 'ethers', '@privy-io/react-auth']
  },
  webpack: (config, { isServer }) => {
    const uaParserMin = path.join(monorepoRoot, 'node_modules/ua-parser-js/dist/ua-parser.min.js');

    const emptyModule = path.join(__dirname, 'src/lib/shims/empty-module.js');

    config.resolve.alias = {
      ...config.resolve.alias,
      '@noble/hashes/_assert': path.join(__dirname, 'src/lib/shims/noble-hashes-assert.js'),
      '@wagmi/connectors': path.join(__dirname, 'src/lib/shims/wagmi-connectors.js'),
      '@farcaster/mini-app-solana': emptyModule,
      '@farcaster/miniapp-sdk': emptyModule,
      '@solana/wallet-adapter-react': emptyModule,
      '@walletconnect/utils': path.join(monorepoRoot, 'node_modules/@walletconnect/utils'),
      '@walletconnect/universal-provider': path.join(monorepoRoot, 'node_modules/@walletconnect/universal-provider'),
      '@walletconnect/sign-client': path.join(monorepoRoot, 'node_modules/@walletconnect/sign-client'),
      '@walletconnect/core': path.join(monorepoRoot, 'node_modules/@walletconnect/core'),
      '@walletconnect/ethereum-provider': path.join(monorepoRoot, 'node_modules/@walletconnect/ethereum-provider'),
      porto: path.join(__dirname, 'src/lib/shims/empty-module.js'),
      'porto/internal': path.join(__dirname, 'src/lib/shims/empty-module.js'),
      'ua-parser-js/dist/ua-parser.min': uaParserMin
    };

    config.resolve.modules = [
      path.join(monorepoRoot, 'node_modules'),
      path.join(__dirname, 'node_modules'),
      ...(config.resolve.modules ?? []),
      'node_modules'
    ];

    if (isServer) {
      const externals = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean);
      externals.push('thirdweb', 'ethers', '@privy-io/react-auth');
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
  },
  async headers() {
    const shared = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'off' }
    ];

    return [
      { source: '/api/:path*', headers: shared },
      { source: '/:path*', headers: shared }
    ];
  }
};

/** Bundle analyzer is dev-only; Vercel production installs omit devDependencies. */
module.exports =
  process.env.ANALYZE === 'true' ? require('./next.config.analyze.js')(nextConfig) : nextConfig;
