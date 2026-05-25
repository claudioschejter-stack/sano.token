import { LandingPage } from '../../components/landing/LandingPage';
import { fetchMarketplaceFeed } from '../../lib/marketplaceApi';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const initialFeed = await fetchMarketplaceFeed();

  return <LandingPage initialFeed={initialFeed} />;
}
