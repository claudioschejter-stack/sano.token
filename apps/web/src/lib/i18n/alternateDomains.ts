import { parseLocalePath } from './localeRouting';

/**
 * Secondary marketing/SEO domains ("Token Vaca Muerta") pointed at the same
 * Vercel project as the canonical `sanovacapital.com`. They're "masked" —
 * the address bar stays on the domain the visitor typed — but only for
 * public marketing content. See `alternateDomainRedirectTarget` below for
 * why everything else still redirects to the canonical domain.
 */
const ALTERNATE_MARKETING_HOSTS = new Set([
  'tokenvacamuerta.org',
  'www.tokenvacamuerta.org',
  'tokenvacamuerta.net',
  'www.tokenvacamuerta.net',
  'vacamuertatoken.org',
  'www.vacamuertatoken.org',
  'vacamuertatoken.net',
  'www.vacamuertatoken.net'
]);

/**
 * Only pages with no session/checkout/payment state may be masked. Anything
 * not on this allowlist (dashboard, marketplace, mercado-secundario, acceso,
 * kyc, api, and any future route) redirects to the canonical domain instead
 * — fail-safe by default, so a new protected route never accidentally gets
 * served (and cookie-scoped) under the wrong domain.
 */
const MASKABLE_MARKETING_PATHS = new Set([
  '/',
  '/nosotros',
  '/faq',
  '/contacto',
  '/privacidad',
  '/terminos',
  '/blog',
  '/videos',
  '/robots.txt',
  '/sitemap.xml',
  '/video-sitemap.xml',
  '/opengraph-image',
  '/llms.txt'
]);

const MASKABLE_MARKETING_PREFIXES = ['/blog/', '/videos/'] as const;

export function isAlternateMarketingHost(host: string | null | undefined): boolean {
  if (!host) {
    return false;
  }
  return ALTERNATE_MARKETING_HOSTS.has(host.toLowerCase());
}

export function isMaskableOnAlternateHost(pathname: string): boolean {
  const { pathname: unprefixed } = parseLocalePath(pathname);
  if (MASKABLE_MARKETING_PATHS.has(unprefixed)) {
    return true;
  }
  return MASKABLE_MARKETING_PREFIXES.some((prefix) => unprefixed.startsWith(prefix));
}
