'use client';

import { useSession } from 'next-auth/react';
import { AccountStatusBanner } from './AccountStatusBanner';

export function PortalAccountStatusBar() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  if (status !== 'authenticated' || role !== 'INVESTOR') {
    return null;
  }

  return <AccountStatusBanner className="mb-6" />;
}
