import { requireInvestorPortalPage } from '../../../../lib/onboarding/requireInvestorPortalPage';
import { InversionesPageClient } from './InversionesPageClient';

export default async function InversionesPage() {
  await requireInvestorPortalPage('/dashboard/inversiones');
  return <InversionesPageClient />;
}
