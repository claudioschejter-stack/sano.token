'use client';

import Link from 'next/link';
import { LandingHeader } from '../landing/LandingHeader';
import { useLocalePath } from '../../hooks/useLocalePath';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { BlogArticle } from '../../content/blog/articles';

type BlogArticlePageProps = {
  article: BlogArticle;
};

export function BlogArticlePage({ article }: BlogArticlePageProps) {
  const t = useTranslation();
  const localePath = useLocalePath();
  const b = t.blog;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <LandingHeader />
      <article className="mx-auto w-full max-w-3xl px-4 py-12 md:px-6 md:py-16">
        <Link
          href={localePath('/blog')}
          className="text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          {b.backToBlog}
        </Link>
        <time className="mt-6 block text-xs font-medium uppercase tracking-wide text-slate-500">
          {article.publishedAt}
        </time>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{article.title}</h1>
        <p className="mt-4 text-lg text-slate-600">{article.description}</p>
        <div className="mt-10 space-y-8">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-bold text-slate-900">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-base leading-relaxed text-slate-700">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
        <div className="mt-12 rounded-2xl border border-blue-100 bg-blue-50 p-6">
          <p className="text-sm text-slate-700">{b.ctaDisclaimer}</p>
          <Link
            href={localePath('/acceso?returnTo=/marketplace')}
            className="mt-4 inline-flex rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            {b.ctaButton}
          </Link>
        </div>
      </article>
    </div>
  );
}
