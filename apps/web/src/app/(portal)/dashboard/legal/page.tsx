import { redirect } from 'next/navigation';
import { auth } from '../../../../auth';
import { LegalPageClient } from './LegalPageClient';

/**
 * Legal terms/privacy are informational, not a trading action, so this page
 * only requires an authenticated session — it must NOT gate on marketplace
 * checkout eligibility (KYC + linked collection wallet), otherwise accounts
 * that haven't finished onboarding could never read the legal terms.
 */
export default async function LegalPage() {
  const session = await auth();

  if (!session?.user?.accessToken || !session.user.id) {
    redirect('/acceso?returnTo=%2Fdashboard%2Flegal');
  }

  return <LegalPageClient />;
}
