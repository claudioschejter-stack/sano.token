'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { UserRoleStatusHeader } from './UserRoleStatusHeader';

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();
  const { isOperational, loading } = useAccountStatus();

  useEffect(() => {
    if (status !== 'authenticated' || loading || isOperational) {
      return;
    }

    if (pathname.startsWith('/kyc')) {
      return;
    }

    const returnTo = encodeURIComponent(pathname);
    router.replace(`/kyc?returnTo=${returnTo}`);
  }, [isOperational, loading, pathname, router, status]);

  return (
    <>
      <UserRoleStatusHeader />
      {children}
    </>
  );
}
