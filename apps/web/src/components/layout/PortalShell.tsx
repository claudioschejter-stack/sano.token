'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { requiresInvestorStyleOnboarding } from '../../lib/onboarding/onboardingGate';

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { isOperational, loading } = useAccountStatus();
  const role = session?.user?.role;

  useEffect(() => {
    if (status !== 'authenticated' || loading || isOperational) {
      return;
    }

    if (!requiresInvestorStyleOnboarding(role)) {
      return;
    }

    if (pathname.startsWith('/kyc')) {
      return;
    }

    const returnTo = encodeURIComponent(pathname);
    router.replace(`/kyc?returnTo=${returnTo}`);
  }, [isOperational, loading, pathname, role, router, status]);

  return <>{children}</>;
}
