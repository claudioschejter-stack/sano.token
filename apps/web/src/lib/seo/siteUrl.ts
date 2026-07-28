import { locales, type Locale } from '../../i18n';
import { withLocalePrefix } from '../i18n/localeRouting';
import { LEGAL_SITE_URL } from '../legal/legalConfig';
import { BLOG_SLUGS, hasNativeTranslation } from '../../content/blog/articles';

/** Canonical production origin (no trailing slash). */
export function getSiteUrl(): string {
  const raw = LEGAL_SITE_URL.trim().replace(/\/$/, '');
  if (raw.includes('sano-token-web.vercel.app')) {
    return 'https://www.sanovacapital.com';
  }
  return raw;
}

// /privacidad and /terminos are intentionally excluded: they carry
// `robots: { index: false }` (boilerplate legal text duplicated across locales)
// and must never be announced in the sitemap.
// /acceso is also excluded (auth surfaces — Disallow in robots.txt).
export const PUBLIC_MARKETING_PATHS = [
  '/',
  // `/nosotros` temporarily excluded from sitemap until further notice.
  '/faq',
  '/contacto',
  '/blog'
] as const;

/**
 * Absolute sitemap URLs for public marketing pages.
 * Blog article locale variants are included only when that locale has a
 * native translation — otherwise Google lists them as
 * "Alternative page with proper canonical tag" (content falls back to en/es).
 */
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

  for (const slug of BLOG_SLUGS) {
    const path = `/blog/${slug}`;
    for (const locale of locales) {
      if (!hasNativeTranslation(slug, locale)) {
        continue;
      }
      urls.push(`${siteUrl}${withLocalePrefix(locale as Locale, path)}`);
    }
  }

  return urls;
}
