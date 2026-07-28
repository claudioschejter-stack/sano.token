import type { Metadata } from 'next';
import type { Locale } from '../../i18n';
import { withLocalePrefix } from '../i18n/localeRouting';
import { getSiteUrl } from './siteUrl';

/**
 * Locales allowed to index pages whose main asset is language-agnostic
 * (YouTube embeds, etc.). Other locales self-serve translated chrome but
 * canonicalize to Spanish so Google does not flag
 * "Duplicada: Google eligió otra canónica diferente a la del usuario".
 */
export const INDEXABLE_MEDIA_LOCALES: readonly Locale[] = ['es', 'en'] as const;

export function isIndexableMediaLocale(locale: Locale): boolean {
  return (INDEXABLE_MEDIA_LOCALES as readonly string[]).includes(locale);
}

/** Content-owner locale for shared media pages (Spanish unprefixed). */
export function mediaContentLocale(locale: Locale): Locale {
  return isIndexableMediaLocale(locale) ? locale : 'es';
}

export function buildMediaAlternates(path: string, locale: Locale): NonNullable<Metadata['alternates']> {
  const siteUrl = getSiteUrl();
  const contentLocale = mediaContentLocale(locale);
  return {
    canonical: `${siteUrl}${withLocalePrefix(contentLocale, path)}`,
    languages: {
      ...Object.fromEntries(
        INDEXABLE_MEDIA_LOCALES.map((code) => [code, `${siteUrl}${withLocalePrefix(code, path)}`])
      ),
      'x-default': `${siteUrl}${path}`
    }
  };
}

export function mediaRobots(locale: Locale): Metadata['robots'] {
  if (isIndexableMediaLocale(locale)) {
    return {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-video-preview': -1
      }
    };
  }
  return {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true }
  };
}
