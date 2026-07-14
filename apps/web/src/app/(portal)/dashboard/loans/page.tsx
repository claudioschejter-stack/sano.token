import { redirect } from 'next/navigation';
import { requireInvestorPortalPage } from '../../../../lib/onboarding/requireInvestorPortalPage';
import { getLoansEnabledForUser } from '../../../../lib/investor/loansPreferenceService';
import { LoansPageClient } from './LoansPageClient';

export default async function LoansPage() {
  const { userId } = await requireInvestorPortalPage('/dashboard/loans');
  const loansEnabled = await getLoansEnabledForUser(userId);
  if (!loansEnabled) {
    redirect('/dashboard/settings/security');
  }
  return <LoansPageClient />;
}
