'use client';

import Link from 'next/link';
import { LandingHeader } from '../landing/LandingHeader';
import { useLocalePath } from '../../hooks/useLocalePath';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { BlogArticle } from '../../content/blog/articles';
import { MorphoMarketsWidget } from './MorphoMarketsWidget';

type BlogIndexPageProps = {
  articles: BlogArticle[];
};

export function BlogIndexPage({ articles }: BlogIndexPageProps) {
  const t = useTranslation();
  const localePath = useLocalePath();
  const b = t.blog;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <LandingHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-12 md:px-6 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{b.title}</h1>
        <p className="mt-3 text-base text-slate-600 md:text-lg">{b.subtitle}</p>
        <ul className="mt-10 space-y-6">
          {articles.map((article) => (
            <li
              key={article.slug}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200"
            >
              <time className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {article.publishedAt}
              </time>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                <Link
                  href={localePath(`/blog/${article.slug}`)}
                  className="hover:text-blue-700"
                >
                  {article.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{article.description}</p>
              <Link
                href={localePath(`/blog/${article.slug}`)}
                className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                {b.readMore}
              </Link>
            </li>
          ))}
        </ul>

        <MorphoMarketsWidget />
      </main>
    </div>
  );
}
