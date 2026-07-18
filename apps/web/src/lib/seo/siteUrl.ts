import { locales, type Locale } from '../../i18n';
import { withLocalePrefix } from '../i18n/localeRouting';
import { LEGAL_SITE_URL } from '../legal/legalConfig';
import { BLOG_SLUGS } from '../../content/blog/articles';

/** Canonical production origin (no trailing slash). */
export function getSiteUrl(): string {
  const raw = LEGAL_SITE_URL.trim().replace(/\/$/, '');
  if (raw.includes('sano-token-web.vercel.app')) {
    return 'https://www.sanovacapital.com';
  }
  return raw;
}

// /privacidad and /terminos are intentionally excluded: they carry
// `robots: { index: false }` (boilerplate legal text duplicated across 15
// locales) and must never be announced in the sitemap.
export const PUBLIC_MARKETING_PATHS = [
  '/',
  // `/nosotros` temporarily excluded from sitemap until further notice.
  '/faq',
  '/contacto',
  '/blog',
  ...BLOG_SLUGS.map((slug) => `/blog/${slug}`)
] as const;

export function buildPublicSitemapUrls(): string[] {
  const siteUrl = getSiteUrl();
  const urls: string[] = [];

  for (const path of PUBLIC_MARKETING_PATHS) {
    urls.push(path === '/' ? siteUrl : `${siteUrl}${path}`);
    for (const locale of locales) {
      if (locale === 'es') {
        continue;
      }
      urls.push(`${siteUrl}${withLocalePrefix(locale, path)}`);
    }
  }

  return urls;
}
