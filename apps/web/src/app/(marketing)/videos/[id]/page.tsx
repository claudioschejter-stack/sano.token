import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VideoWatchPage } from '../../../../components/landing/VideoWatchPage';
import { resolveServerLocale } from '../../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../../lib/seo/buildMetadata';
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
  const video = await getSanovaYouTubeVideoById(params.id);
  const path = `/videos/${params.id}`;
  const base = buildSiteMetadata(locale, path);

  if (!video) {
    return base;
  }

  const t = messagesByLocale[locale].videos;
  const title = video.title ? `${video.title} | Sanova Global` : 'Sanova Global — YouTube';
  const description = video.description?.slice(0, 300) || t.defaultDescription;

  return {
    ...base,
    title: { absolute: title },
    description,
    openGraph: {
      ...base.openGraph,
      title,
      description,
      type: 'video.other',
      url: `${getSiteUrl()}${withLocalePrefix(locale, path)}`,
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
  const pageUrl = `${siteUrl}${withLocalePrefix(locale, `/videos/${video.id}`)}`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title ?? 'Sanova Global',
    description: video.description?.trim() || t.defaultDescription,
    thumbnailUrl: [video.thumbnailUrl],
    uploadDate: video.publishedAt ?? undefined,
    embedUrl: video.embedUrl,
    url: pageUrl,
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
  const [locale, video] = await Promise.all([
    resolveServerLocale(),
    getSanovaYouTubeVideoById(params.id)
  ]);

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
