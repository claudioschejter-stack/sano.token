import type { Locale } from '../../lib/i18n/localeCodes';
import type { BlogArticle } from './types';
import { blogArticlesEn } from './catalog-en';
import { blogArticlesEs } from './catalog-es';
import { blogArticlesAr } from './locales/ar';
import { blogArticlesBn } from './locales/bn';
import { blogArticlesDe } from './locales/de';
import { blogArticlesFr } from './locales/fr';
import { blogArticlesHi } from './locales/hi';
import { blogArticlesId } from './locales/id';
import { blogArticlesJa } from './locales/ja';
import { blogArticlesMr } from './locales/mr';
import { blogArticlesPt } from './locales/pt';
import { blogArticlesRu } from './locales/ru';
import { blogArticlesSw } from './locales/sw';
import { blogArticlesUr } from './locales/ur';
import { blogArticlesZh } from './locales/zh';

export type { BlogArticle, BlogSection } from './types';

const BLOG_BY_LOCALE: Record<string, Record<string, BlogArticle>> = {
  es: blogArticlesEs,
  en: blogArticlesEn,
  zh: blogArticlesZh,
  hi: blogArticlesHi,
  fr: blogArticlesFr,
  ar: blogArticlesAr,
  bn: blogArticlesBn,
  pt: blogArticlesPt,
  ru: blogArticlesRu,
  ur: blogArticlesUr,
  id: blogArticlesId,
  de: blogArticlesDe,
  ja: blogArticlesJa,
  sw: blogArticlesSw,
  mr: blogArticlesMr
};

const FALLBACK_LOCALES: Locale[] = ['en', 'es'];

export const BLOG_SLUGS = Object.keys(blogArticlesEs);

export const BLOG_LOCALIZED_LOCALES = Object.keys(BLOG_BY_LOCALE);

export function getBlogArticle(slug: string, locale: string): BlogArticle | null {
  if (!BLOG_SLUGS.includes(slug)) {
    return null;
  }

  const localesToTry = [locale, ...FALLBACK_LOCALES.filter((code) => code !== locale)];
  for (const code of localesToTry) {
    const article = BLOG_BY_LOCALE[code]?.[slug];
    if (article) {
      return article;
    }
  }

  return null;
}

/** True when `locale` has its own translated content for `slug` (not a fallback). */
export function hasNativeTranslation(slug: string, locale: string): boolean {
  return Boolean(BLOG_BY_LOCALE[locale]?.[slug]);
}

/**
 * Locale code that actually serves the content for `slug`/`locale` — the
 * requested locale if it has a native translation, otherwise the fallback
 * locale (`en`, then `es`) that `getBlogArticle` resolves to. Used to point
 * the canonical tag at the locale that really owns the content, instead of
 * self-referencing a URL that duplicates another locale's article.
 */
export function resolveArticleLocale(slug: string, locale: Locale): Locale | null {
  if (!BLOG_SLUGS.includes(slug)) {
    return null;
  }

  if (hasNativeTranslation(slug, locale)) {
    return locale;
  }

  for (const code of FALLBACK_LOCALES) {
    if (BLOG_BY_LOCALE[code]?.[slug]) {
      return code;
    }
  }

  return null;
}

export function listBlogArticles(locale: string): BlogArticle[] {
  return BLOG_SLUGS.map((slug) => getBlogArticle(slug, locale)).filter(
    (article): article is BlogArticle => article !== null
  );
}
