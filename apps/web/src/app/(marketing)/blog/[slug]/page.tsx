import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogArticlePage } from '../../../../components/blog/BlogArticlePage';
import { BLOG_SLUGS, getBlogArticle } from '../../../../content/blog/articles';
import { locales } from '../../../../i18n';
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
        ...Object.fromEntries(
          locales.map((code) => [code, `${siteUrl}${withLocalePrefix(code, path)}`])
        ),
        'x-default': `${siteUrl}${path}`
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

function ArticleJsonLd({ article, canonical, siteUrl }: {
  article: NonNullable<ReturnType<typeof getBlogArticle>>;
  canonical: string;
  siteUrl: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    url: canonical,
    image: `${siteUrl}/icons/icon-512.png`,
    publisher: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Sanova Global SAS',
      logo: { '@type': 'ImageObject', url: `${siteUrl}/icons/icon-512.png` }
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical }
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function BlogSlugPage({ params }: PageProps) {
  const locale = await resolveServerLocale();
  const article = getBlogArticle(params.slug, locale);
  if (!article) {
    notFound();
  }
  const siteUrl = getSiteUrl();
  const path = `/blog/${article.slug}`;
  const canonical = `${siteUrl}${withLocalePrefix(locale, path)}`;
  return (
    <>
      <ArticleJsonLd article={article} canonical={canonical} siteUrl={siteUrl} />
      <BlogArticlePage article={article} />
    </>
  );
}
