'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, type ReactNode } from 'react';
import { DashboardSkeleton } from '../dashboard/DashboardSkeleton';
import type { SystemRole } from '../../lib/auth/roles';

type AdvisorGateProps = {
  children: ReactNode;
  allowManager?: boolean;
};

const ADVISOR_ROLES: SystemRole[] = ['ADVISOR', 'ADVISOR_MANAGER'];

export function AdvisorGate({ children, allowManager = true }: AdvisorGateProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const allowed =
    role === 'ADVISOR' || (allowManager && role === 'ADVISOR_MANAGER');

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (!allowed) {
      router.replace('/dashboard');
    }
  }, [allowed, router, status]);

  if (status === 'loading' || !allowed) {
    return <DashboardSkeleton />;
  }

  return children;
}

export function isAdvisorStaffRole(role?: SystemRole | null): boolean {
  return Boolean(role && ADVISOR_ROLES.includes(role));
}
