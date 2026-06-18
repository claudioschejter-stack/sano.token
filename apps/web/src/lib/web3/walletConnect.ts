const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_ENV === 'production'
    ? 'https://www.sanovacapital.com'
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://www.sanovacapital.com');

/** WalletConnect / Reown Cloud project id (public). */
export const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim() ?? '';

export const isWalletConnectConfigured = walletConnectProjectId.length > 0;

const normalizedSiteUrl = siteUrl.replace(/\/$/, '');

export const walletConnectMetadata = {
  name: 'Sanova Global',
  description: 'Inversión inmobiliaria tokenizada en Base',
  url: normalizedSiteUrl,
  icons: [`${normalizedSiteUrl}/icons/apple-touch-icon.png`, `${normalizedSiteUrl}/favicon.ico`]
};

/** Domains to allowlist in https://cloud.reown.com */
export const walletConnectAllowedOrigins = [
  'https://www.sanovacapital.com',
  'https://sanovacapital.com',
  'https://sano-token-web.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
] as const;
