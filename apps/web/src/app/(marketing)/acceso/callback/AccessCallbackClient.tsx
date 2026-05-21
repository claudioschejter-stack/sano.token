'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { resolvePostLoginPath } from '../../../../lib/auth/roles';
import type { SystemRole } from '../../../../lib/auth/roles';

export default function AccessCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

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
    const destination = returnTo ?? resolvePostLoginPath(role);
    router.replace(destination);
  }, [router, searchParams, session?.authError, session?.user?.role, status]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
      <p className="text-sm font-medium">Redirigiendo según tu rol…</p>
    </div>
  );
}
