'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { resolveAuthenticatedDestination } from '../../../../lib/auth/redirects';
import type { SystemRole } from '../../../../lib/auth/roles';
import { useAccountStatus } from '../../../../hooks/useAccountStatus';

export default function AccessCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { isOperational } = useAccountStatus();

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated' || session?.authError) {
      router.replace('/acceso?error=auth');
      return;
    }

    const returnTo = searchParams.get('returnTo');
    const role = (session?.user?.role ?? 'INVESTOR') as SystemRole;
    const destination = resolveAuthenticatedDestination(role, returnTo, isOperational);
    router.replace(destination);
  }, [isOperational, router, searchParams, session?.authError, session?.user?.role, status]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
      <p className="text-sm font-medium">Redirigiendo según tu rol…</p>
    </div>
  );
}
