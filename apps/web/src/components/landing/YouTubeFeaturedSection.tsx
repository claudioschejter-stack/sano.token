'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import type { FeaturedYouTubeVideo } from '../../config/social';
import { getYouTubeUrl } from '../../config/social';
import { withLocalePrefix } from '../../lib/i18n/localeRouting';

type YouTubeFeaturedSectionProps = {
  videos: FeaturedYouTubeVideo[];
};

export function YouTubeFeaturedSection({ videos }: YouTubeFeaturedSectionProps) {
  const t = useTranslation();
  const { locale } = useLocale();
  const y = t.landing.youtube;

  if (videos.length === 0) {
    return null;
  }

  return (
    <section
      id="youtube"
      className="border-y border-slate-200 bg-slate-50 py-16 md:py-20"
      aria-labelledby="youtube-section-title"
    >
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="youtube-section-title" className="text-3xl font-bold text-slate-900 md:text-4xl">
            <a
              href={getYouTubeUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-blue-600"
            >
              {y.title}
            </a>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-base">{y.subtitle}</p>
        </div>

        <div
          className={`mt-10 grid grid-cols-1 gap-6 md:mt-12 ${
            videos.length === 1
              ? 'mx-auto max-w-3xl'
              : videos.length === 2
                ? 'md:grid-cols-2'
                : 'md:grid-cols-2 lg:grid-cols-3'
          }`}
          aria-label={y.ariaLabel}
        >
          {videos.map((video) => (
            <article
              key={video.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="relative aspect-video w-full bg-slate-900">
                <iframe
                  src={video.embedUrl}
                  title={video.title ? `${video.title} — Sanova Global` : `${y.title} — ${video.id}`}
                  className="absolute inset-0 h-full w-full"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                {video.title ? (
                  <Link
                    href={withLocalePrefix(locale, `/videos/${video.id}`)}
                    className="min-w-0 truncate text-sm font-medium text-slate-800 hover:text-blue-600"
                  >
                    {video.title}
                  </Link>
                ) : (
                  <Link
                    href={withLocalePrefix(locale, `/videos/${video.id}`)}
                    className="text-sm font-medium text-slate-800 hover:text-blue-600"
                  >
                    {y.viewDetail}
                  </Link>
                )}
                <a
                  href={video.watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-500"
                >
                  {y.watchOnYoutube}
                  <ExternalLink size={14} aria-hidden />
                </a>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center">
          <a
            href={getYouTubeUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            {y.channelCta}
            <ExternalLink size={14} aria-hidden />
          </a>
        </p>
      </div>
    </section>
  );
}
