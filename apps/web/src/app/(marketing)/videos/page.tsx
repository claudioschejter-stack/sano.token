import type { Metadata } from 'next';
import { VideosIndexPage } from '../../../components/landing/VideosIndexPage';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';
import { withLocalePrefix } from '../../../lib/i18n/localeRouting';
import { getSiteUrl } from '../../../lib/seo/siteUrl';
import { getSanovaYouTubeChannelVideos } from '../../../lib/youtube/channelVideos';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/videos');
  const isEs = locale === 'es';

  const ogTitle = isEs
    ? 'Videos de Sanova Global | Vaca Muerta RWA'
    : 'Sanova Global Videos | Vaca Muerta RWA';
  const ogDescription = isEs
    ? 'Videos oficiales del canal de YouTube de Sanova Global: propiedades tokenizadas, proyectos en Vaca Muerta y explicaciones sobre inversión RWA.'
    : 'Official YouTube videos from Sanova Global: tokenized properties, Vaca Muerta projects, and RWA investment explainers.';

  return {
    ...base,
    title: { absolute: ogTitle },
    description: ogDescription,
    openGraph: {
      ...base.openGraph,
      title: ogTitle,
      description: ogDescription,
      url: `${getSiteUrl()}${withLocalePrefix(locale, '/videos')}`
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
