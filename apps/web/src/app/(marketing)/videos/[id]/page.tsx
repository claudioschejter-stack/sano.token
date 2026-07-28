import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { VideoWatchPage } from '../../../../components/landing/VideoWatchPage';
import { resolveServerLocale } from '../../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../../lib/seo/buildMetadata';
import {
  buildMediaAlternates,
  isIndexableMediaLocale,
  mediaContentLocale,
  mediaRobots
} from '../../../../lib/seo/mediaLocalePolicy';
import { withLocalePrefix } from '../../../../lib/i18n/localeRouting';
import { getSiteUrl } from '../../../../lib/seo/siteUrl';
import { getSanovaYouTubeVideoById } from '../../../../lib/youtube/channelVideos';
import { messagesByLocale, type Locale } from '../../../../i18n';
import type { FeaturedYouTubeVideo } from '../../../../config/social';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: { id: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const path = `/videos/${params.id}`;

  // Non-indexable locales 308 to Spanish — metadata here is only for es/en.
  if (!isIndexableMediaLocale(locale)) {
    return buildSiteMetadata('es', path);
  }

  const video = await getSanovaYouTubeVideoById(params.id);
  const base = buildSiteMetadata(locale, path);

  if (!video) {
    return {
      ...base,
      alternates: buildMediaAlternates(path, locale),
      robots: mediaRobots(locale)
    };
  }

  const t = messagesByLocale[locale].videos;
  const title = video.title ? `${video.title} | Sanova Global` : 'Sanova Global — YouTube';
  const description = video.description?.slice(0, 300) || t.defaultDescription;
  const contentLocale = mediaContentLocale(locale);
  const canonical = `${getSiteUrl()}${withLocalePrefix(contentLocale, path)}`;

  return {
    ...base,
    title: { absolute: title },
    description,
    alternates: buildMediaAlternates(path, locale),
    robots: mediaRobots(locale),
    openGraph: {
      ...base.openGraph,
      title,
      description,
      type: 'video.other',
      url: canonical,
      images: [{ url: video.thumbnailUrl }]
    },
    twitter: {
      ...base.twitter,
      title,
      description,
      images: [video.thumbnailUrl]
    }
  };
}

function VideoJsonLd({
  video,
  locale,
  siteUrl
}: {
  video: FeaturedYouTubeVideo;
  locale: Locale;
  siteUrl: string;
}) {
  const t = messagesByLocale[locale].videos;
  const contentLocale = mediaContentLocale(locale);
  const pageUrl = `${siteUrl}${withLocalePrefix(contentLocale, `/videos/${video.id}`)}`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title ?? 'Sanova Global',
    description: video.description?.trim() || t.defaultDescription,
    thumbnailUrl: [video.thumbnailUrl],
    uploadDate: video.publishedAt ?? undefined,
    embedUrl: video.embedUrl,
    url: pageUrl,
    inLanguage: contentLocale === 'en' ? 'en' : 'es',
    publisher: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Sanova Global SAS'
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function VideoWatchRoute({ params }: PageProps) {
  const locale = await resolveServerLocale();

  // /he/videos/… and /sw/videos/… etc. → permanent Spanish canonical (clears GSC 404s).
  if (!isIndexableMediaLocale(locale)) {
    permanentRedirect(`/videos/${params.id}`);
  }

  const video = await getSanovaYouTubeVideoById(params.id);

  if (!video) {
    notFound();
  }

  return (
    <>
      <VideoJsonLd video={video} locale={locale} siteUrl={getSiteUrl()} />
      <VideoWatchPage video={video} locale={locale} />
    </>
  );
}
