import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { Locale } from '../../i18n';
import { messagesByLocale } from '../../i18n';
import { withLocalePrefix } from '../../lib/i18n/localeRouting';
import type { FeaturedYouTubeVideo } from '../../config/social';
import { LandingHeader } from './LandingHeader';

type VideoWatchPageProps = {
  video: FeaturedYouTubeVideo;
  locale: Locale;
};

function formatPublishedDate(publishedAt: string | undefined, intlLocale: string): string | null {
  if (!publishedAt) {
    return null;
  }

  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(intlLocale, { dateStyle: 'long' }).format(date);
}

export function VideoWatchPage({ video, locale }: VideoWatchPageProps) {
  const t = messagesByLocale[locale].videos;
  const publishedLabel = formatPublishedDate(video.publishedAt, locale === 'es' ? 'es-AR' : 'en-US');

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      {/* Video is the primary content of this page, placed immediately below
          the header so it's the dominant element in the initial viewport —
          this is what qualifies the page as a "watch page" for Google's
          video indexing (as opposed to supplementary embeds elsewhere). */}
      <main className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-14">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          {video.title ?? 'Sanova Global'}
        </h1>

        <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-2xl bg-slate-900 shadow-sm">
          <iframe
            src={video.embedUrl}
            title={video.title ?? 'Sanova Global'}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          {publishedLabel ? (
            <p className="text-sm text-slate-500">
              {t.publishedOn.replace('{date}', publishedLabel)}
            </p>
          ) : (
            <span />
          )}
          <a
            href={video.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-500"
          >
            {t.watchOnYoutube}
            <ExternalLink size={14} aria-hidden />
          </a>
        </div>

        {video.description ? (
          <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {video.description}
          </p>
        ) : null}

        <p className="mt-10">
          <Link
            href={withLocalePrefix(locale, '/videos')}
            className="text-sm font-semibold text-blue-600 hover:text-blue-500"
          >
            {t.backToVideos}
          </Link>
        </p>
      </main>
    </div>
  );
}
