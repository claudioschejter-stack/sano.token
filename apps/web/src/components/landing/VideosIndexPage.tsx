import Link from 'next/link';
import type { Locale } from '../../i18n';
import { messagesByLocale } from '../../i18n';
import { withLocalePrefix } from '../../lib/i18n/localeRouting';
import type { FeaturedYouTubeVideo } from '../../config/social';
import { LandingHeader } from './LandingHeader';

type VideosIndexPageProps = {
  videos: FeaturedYouTubeVideo[];
  locale: Locale;
};

export function VideosIndexPage({ videos, locale }: VideosIndexPageProps) {
  const t = messagesByLocale[locale].videos;

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      <main className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            YouTube
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {t.indexTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            {t.indexSubtitle}
          </p>
        </div>

        {videos.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
            {t.indexEmpty}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <Link
                key={video.id}
                href={withLocalePrefix(locale, `/videos/${video.id}`)}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element -- external YouTube thumbnail, not optimizable via next/image remotePatterns */}
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title ?? 'Sanova Global'}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="px-4 py-3">
                  <p className="truncate text-sm font-medium text-slate-800 group-hover:text-blue-600">
                    {video.title ?? 'Sanova Global'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="mt-12 text-center">
          <Link href={withLocalePrefix(locale, '/')} className="text-sm font-semibold text-blue-600 hover:text-blue-500">
            {t.backToHome}
          </Link>
        </p>
      </main>
    </div>
  );
}
