import { requireInvestorPortalPage } from '../../../../lib/onboarding/requireInvestorPortalPage';
import { CashFlowPageClient } from './CashFlowPageClient';

export default async function CashFlowPage() {
  await requireInvestorPortalPage('/dashboard/cash-flow');
  return <CashFlowPageClient />;
}
