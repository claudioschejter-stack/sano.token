import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogArticlePage } from '../../../../components/blog/BlogArticlePage';
import { BLOG_SLUGS, getBlogArticle } from '../../../../content/blog/articles';
import { resolveServerLocale } from '../../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../../lib/seo/buildMetadata';
import { withLocalePrefix } from '../../../../lib/i18n/localeRouting';
import { getSiteUrl } from '../../../../lib/seo/siteUrl';

type PageProps = {
  params: { slug: string };
};

export function generateStaticParams() {
  return BLOG_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const article = getBlogArticle(params.slug, locale);
  if (!article) {
    return buildSiteMetadata(locale, '/blog');
  }

  const siteUrl = getSiteUrl();
  const path = `/blog/${article.slug}`;
  const base = buildSiteMetadata(locale, path);

  return {
    ...base,
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    alternates: {
      canonical: `${siteUrl}${withLocalePrefix(locale, path)}`,
      languages: {
        es: `${siteUrl}/blog/${article.slug}`,
        en: `${siteUrl}/en/blog/${article.slug}`,
        pt: `${siteUrl}/pt/blog/${article.slug}`,
        'x-default': `${siteUrl}/blog/${article.slug}`
      }
    },
    openGraph: {
      ...base.openGraph,
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.publishedAt
    }
  };
}

export default async function BlogSlugPage({ params }: PageProps) {
  const locale = await resolveServerLocale();
  const article = getBlogArticle(params.slug, locale);
  if (!article) {
    notFound();
  }
  return <BlogArticlePage article={article} />;
}
