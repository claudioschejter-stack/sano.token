import type { Metadata } from 'next';
import { LandingPage } from '../../components/landing/LandingPage';
import { fetchMarketplaceFeed } from '../../lib/marketplace/marketplaceFeedServer';
import { getSanovaYouTubeChannelVideos } from '../../lib/youtube/channelVideos';
import { resolveServerLocale } from '../../i18n/detectLocaleServer';
import { messagesByLocale } from '../../i18n';
import { buildSiteMetadata } from '../../lib/seo/buildMetadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/');
  // Use each locale's own meta catalog — do NOT collapse every non-es locale
  // into a single English title/description (that made /id, /de, /ar look like
  // duplicates and let Google pick a different canonical).
  const meta = messagesByLocale[locale].meta;

  return {
    ...base,
    title: { absolute: meta.title },
    description: meta.description,
    openGraph: {
      ...base.openGraph,
      title: meta.title,
      description: meta.description
    },
    twitter: {
      ...base.twitter,
      title: meta.title,
      description: meta.description
    }
  };
}

export default async function HomePage() {
  const [initialFeed, youtubeVideos] = await Promise.all([
    fetchMarketplaceFeed(),
    getSanovaYouTubeChannelVideos()
  ]);

  return <LandingPage initialFeed={initialFeed} youtubeVideos={youtubeVideos} />;
}
