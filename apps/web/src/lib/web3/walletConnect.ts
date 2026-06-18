const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://sano-token-web.vercel.app');

/** WalletConnect / Reown Cloud project id (public). */
export const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim() ?? '';

export const isWalletConnectConfigured = walletConnectProjectId.length > 0;

export const walletConnectMetadata = {
  name: 'Sanova Global',
  description: 'Inversión inmobiliaria tokenizada en Base',
  url: siteUrl.replace(/\/$/, ''),
  icons: [`${siteUrl.replace(/\/$/, '')}/favicon.ico`]
};

/** Domains to allowlist in https://cloud.reown.com */
export const walletConnectAllowedOrigins = [
  'https://www.sanovacapital.com',
  'https://sanovacapital.com',
  'https://sano-token-web.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
] as const;
