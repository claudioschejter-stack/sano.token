'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, type ReactNode } from 'react';
import { DashboardSkeleton } from '../dashboard/DashboardSkeleton';

type AdminGateProps = {
  children: ReactNode;
};

export function AdminGate({ children }: AdminGateProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (!isAdmin) {
      router.replace('/dashboard');
    }
  }, [isAdmin, router, status]);

  if (status === 'loading' || !isAdmin) {
    return <DashboardSkeleton />;
  }

  return children;
}
