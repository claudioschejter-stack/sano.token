import type { Metadata } from 'next';
import {
  intlLocaleByCode,
  messagesByLocale,
  rtlLocales,
  type Locale
} from '../../i18n';
import { getSiteUrl } from './siteUrl';

const OG_LOCALE_MAP: Record<Locale, string> = {
  en: 'en_US',
  es: 'es_AR',
  pt: 'pt_BR',
  fr: 'fr_FR',
  de: 'de_DE',
  zh: 'zh_CN',
  hi: 'hi_IN',
  ar: 'ar_SA',
  bn: 'bn_BD',
  ru: 'ru_RU',
  ur: 'ur_PK',
  id: 'id_ID',
  ja: 'ja_JP',
  sw: 'sw_KE',
  mr: 'mr_IN'
};

export function buildSiteMetadata(locale: Locale, path = '/'): Metadata {
  const messages = messagesByLocale[locale];
  const siteUrl = getSiteUrl();
  const canonicalPath = path === '/' ? '' : path;
  const canonical = `${siteUrl}${canonicalPath}`;
  const ogImage = `${siteUrl}/icons/icon-512.png`;

  const keywords = messages.meta.keywords ?? '';
  const openGraphLocale = OG_LOCALE_MAP[locale] ?? 'en_US';
  const alternateLocales = Object.entries(OG_LOCALE_MAP)
    .filter(([code]) => code !== locale)
    .map(([, og]) => og);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: messages.meta.title,
      template: `%s | Sanova Global`
    },
    description: messages.meta.description,
    keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
    authors: [{ name: 'Sanova Global SAS', url: siteUrl }],
    creator: 'Sanova Global',
    publisher: 'Sanova Global',
    category: 'finance',
    alternates: {
      canonical
    },
    openGraph: {
      type: 'website',
      locale: openGraphLocale,
      alternateLocale: alternateLocales,
      url: canonical,
      siteName: 'Sanova Global',
      title: messages.meta.title,
      description: messages.meta.description,
      images: [
        {
          url: ogImage,
          width: 512,
          height: 512,
          alt: messages.meta.ogImageAlt ?? 'Sanova Global — RWA tokenized real estate'
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: messages.meta.title,
      description: messages.meta.description,
      images: [ogImage]
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1
      }
    },
    other: {
      'geo.region': 'AR-N',
      'geo.placename': 'Vaca Muerta, Neuquén, Argentina'
    }
  };
}

export function htmlDirForLocale(locale: Locale): 'ltr' | 'rtl' {
  return rtlLocales.includes(locale) ? 'rtl' : 'ltr';
}

export function htmlLangForLocale(locale: Locale): string {
  return intlLocaleByCode[locale] ?? locale;
}
