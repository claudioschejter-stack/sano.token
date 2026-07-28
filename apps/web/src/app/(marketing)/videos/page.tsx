import type { Metadata } from 'next';
import { VideosIndexPage } from '../../../components/landing/VideosIndexPage';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';
import {
  buildMediaAlternates,
  mediaContentLocale,
  mediaRobots
} from '../../../lib/seo/mediaLocalePolicy';
import { withLocalePrefix } from '../../../lib/i18n/localeRouting';
import { getSiteUrl } from '../../../lib/seo/siteUrl';
import { getSanovaYouTubeChannelVideos } from '../../../lib/youtube/channelVideos';
import { messagesByLocale } from '../../../i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const path = '/videos';
  const base = buildSiteMetadata(locale, path);
  const videosCopy = messagesByLocale[locale].videos;
  const ogTitle = `${videosCopy.indexTitle} | Sanova Global`;
  const ogDescription = videosCopy.indexSubtitle || videosCopy.defaultDescription;
  const contentLocale = mediaContentLocale(locale);
  const canonical = `${getSiteUrl()}${withLocalePrefix(contentLocale, path)}`;

  return {
    ...base,
    title: { absolute: ogTitle },
    description: ogDescription,
    alternates: buildMediaAlternates(path, locale),
    robots: mediaRobots(locale),
    openGraph: {
      ...base.openGraph,
      title: ogTitle,
      description: ogDescription,
      url: canonical
    },
    twitter: {
      ...base.twitter,
      title: ogTitle,
      description: ogDescription
    }
  };
}

export default async function VideosIndexRoute() {
  const [locale, videos] = await Promise.all([resolveServerLocale(), getSanovaYouTubeChannelVideos()]);

  return <VideosIndexPage videos={videos} locale={locale} />;
}
