import { requireInvestorPortalPage } from '../../../../lib/onboarding/requireInvestorPortalPage';
import { NotificationsPageClient } from './NotificationsPageClient';

export default async function NotificationsPage() {
  await requireInvestorPortalPage('/dashboard/notifications');
  return <NotificationsPageClient />;
}
