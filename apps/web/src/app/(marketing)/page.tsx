import type { Metadata } from 'next';
import { LandingPage } from '../../components/landing/LandingPage';
import { fetchMarketplaceFeed } from '../../lib/marketplace/marketplaceFeedServer';
import { getSanovaYouTubeChannelVideos } from '../../lib/youtube/channelVideos';
import { resolveServerLocale } from '../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../lib/seo/buildMetadata';
import { getSiteUrl } from '../../lib/seo/siteUrl';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/');
  const siteUrl = getSiteUrl();
  const isEs = locale === 'es';

  return {
    ...base,
    title: isEs
      ? 'Sanova Global — Inversión Vaca Muerta | Tokens RWA e Inmuebles Tokenizados'
      : 'Sanova Global — Vaca Muerta RWA Investment | Tokenized Real Estate USDC',
    description: isEs
      ? 'Invertí en inmuebles tokenizados y activos reales (RWA) en Vaca Muerta, Argentina. Colocación privada con rentas en USDC, cumplimiento KYC y dividendos on-chain. APY hasta 12.8%.'
      : 'Invest in tokenized real estate and RWA assets in Vaca Muerta, Argentina. Private placement with USDC income, KYC compliance, and on-chain dividend distribution. APY up to 12.8%.',
    alternates: {
      ...base.alternates,
      canonical: siteUrl
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
