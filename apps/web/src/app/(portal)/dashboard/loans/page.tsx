import { requireInvestorPortalPage } from '../../../../lib/onboarding/requireInvestorPortalPage';
import { LoansPageClient } from './LoansPageClient';

export default async function LoansPage() {
  await requireInvestorPortalPage('/dashboard/loans');
  return <LoansPageClient />;
}
