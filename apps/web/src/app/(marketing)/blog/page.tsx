import type { Metadata } from 'next';
import { BlogIndexPage } from '../../../components/blog/BlogIndexPage';
import { listBlogArticles } from '../../../content/blog/articles';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { messagesByLocale } from '../../../i18n';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';
import { withLocalePrefix } from '../../../lib/i18n/localeRouting';
import { getSiteUrl } from '../../../lib/seo/siteUrl';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/blog');
  const blog = messagesByLocale[locale].blog;
  const siteUrl = getSiteUrl();
  return {
    ...base,
    title: blog.title,
    description: blog.subtitle,
    alternates: {
      canonical: `${siteUrl}${withLocalePrefix(locale, '/blog')}`,
      languages: {
        es: `${siteUrl}/blog`,
        en: `${siteUrl}/en/blog`,
        pt: `${siteUrl}/pt/blog`,
        fr: `${siteUrl}/fr/blog`,
        de: `${siteUrl}/de/blog`,
        'x-default': `${siteUrl}/blog`
      }
    }
  };
}

export default async function BlogPage() {
  const locale = await resolveServerLocale();
  const articles = listBlogArticles(locale);
  return <BlogIndexPage articles={articles} />;
}
