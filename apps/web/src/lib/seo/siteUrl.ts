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

/**
 * Locales announced in the sitemap for marketing shells (home, FAQ, etc.).
 * Listing all 16 locales × every path floods Google’s crawl budget and leaves
 * hundreds of URLs in “Descubierta: actualmente sin indexar” with no crawl date.
 * Other locales remain reachable via hreflang on these primary pages.
 */
export const INDEXABLE_SHELL_LOCALES: readonly Locale[] = ['es', 'en'] as const;

// /acceso is excluded (auth — meta noindex, not listed here).
export const PUBLIC_MARKETING_PATHS = [
  '/',
  '/nosotros',
  '/faq',
  '/contacto',
  '/blog',
  '/privacidad',
  '/terminos'
] as const;

function absoluteFor(siteUrl: string, locale: Locale, path: string): string {
  if (locale === 'es' && path === '/') {
    return siteUrl;
  }
  return `${siteUrl}${withLocalePrefix(locale, path)}`;
}

/**
 * Absolute sitemap URLs for public marketing pages.
 * - Shells (FAQ, home, …): es + en only
 * - Blog index for other locales: only when that locale has ≥1 native article
 * - Blog articles: only native translations
 */
export function buildPublicSitemapUrls(): string[] {
  const siteUrl = getSiteUrl();
  const urls: string[] = [];
  const seen = new Set<string>();

  const push = (url: string) => {
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  };

  for (const path of PUBLIC_MARKETING_PATHS) {
    for (const locale of INDEXABLE_SHELL_LOCALES) {
      push(absoluteFor(siteUrl, locale, path));
    }
  }

  for (const locale of locales) {
    if ((INDEXABLE_SHELL_LOCALES as readonly string[]).includes(locale)) {
      continue;
    }
    const hasNativeBlog = BLOG_SLUGS.some((slug) => hasNativeTranslation(slug, locale));
    if (hasNativeBlog) {
      push(absoluteFor(siteUrl, locale, '/blog'));
    }
  }

  for (const slug of BLOG_SLUGS) {
    const path = `/blog/${slug}`;
    for (const locale of locales) {
      if (!hasNativeTranslation(slug, locale)) {
        continue;
      }
      push(absoluteFor(siteUrl, locale as Locale, path));
    }
  }

  return urls;
}
