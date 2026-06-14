import { requireCashFlowPortalPage } from '../../../../lib/onboarding/requireInvestorPortalPage';
import { CashFlowPageClient } from './CashFlowPageClient';

export default async function CashFlowPage() {
  await requireCashFlowPortalPage('/dashboard/cash-flow');
  return <CashFlowPageClient />;
}
