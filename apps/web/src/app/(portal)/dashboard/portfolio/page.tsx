import { requireInvestorPortalPage } from '../../../../lib/onboarding/requireInvestorPortalPage';
import { PortfolioPageClient } from './PortfolioPageClient';

export default async function PortfolioPage() {
  await requireInvestorPortalPage('/dashboard/portfolio');
  return <PortfolioPageClient />;
}
