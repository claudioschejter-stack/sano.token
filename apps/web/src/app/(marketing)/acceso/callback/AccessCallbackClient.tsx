'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../../i18n/LocaleProvider';
import { resolveAuthenticatedDestination } from '../../../../lib/auth/redirects';
import type { SystemRole } from '../../../../lib/auth/roles';
import { buildKycUrl, DEFAULT_POST_ONBOARDING_PATH } from '../../../../lib/auth/kycPaths';
import { useAccountStatus } from '../../../../hooks/useAccountStatus';

export default function AccessCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const access = useTranslation().access;
  const { isOperational, loading, refresh, checklist } = useAccountStatus();
  const diditSyncStarted = useRef(false);
  const [diditSyncing, setDiditSyncing] = useState(false);
  const hasDiditStatus = searchParams.has('status') || searchParams.has('verificationSessionId');

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated' || session?.authError) {
      const errorCode =
        session?.authError === 'CUENTA_BLOQUEADA' ? 'CUENTA_BLOQUEADA' : 'auth';
      router.replace(`/acceso?error=${errorCode}`);
      return;
    }

    if (session?.user?.totpPending && session.user.pendingTotpToken) {
      const params = new URLSearchParams({
        t: session.user.pendingTotpToken,
        callbackUrl: searchParams.get('returnTo') ?? DEFAULT_POST_ONBOARDING_PATH
      });
      router.replace(`/acceso/verificar-2fa?${params.toString()}`);
      return;
    }

    if (loading || diditSyncing || (hasDiditStatus && !diditSyncStarted.current)) {
      return;
    }

    const returnTo = searchParams.get('returnTo');
    const role = (session?.user?.role ?? 'INVESTOR') as SystemRole;

    const needsTotpStep =
      !isOperational &&
      checklist?.kycApproved &&
      checklist.walletLinked &&
      !checklist.totpEnabled;

    const destination = needsTotpStep
      ? buildKycUrl(returnTo, DEFAULT_POST_ONBOARDING_PATH, 'totp')
      : resolveAuthenticatedDestination(role, returnTo, isOperational);

    router.replace(destination);
  }, [checklist?.kycApproved, checklist?.totpEnabled, checklist?.walletLinked, diditSyncing, hasDiditStatus, isOperational, loading, router, searchParams, session?.authError, session?.user?.pendingTotpToken, session?.user?.role, session?.user?.totpPending, status]);

  useEffect(() => {
    if (status === 'authenticated' && hasDiditStatus && !diditSyncStarted.current) {
      diditSyncStarted.current = true;
      setDiditSyncing(true);
      void fetch('/api/onboarding/didit/status', {
        method: 'POST',
        credentials: 'same-origin'
      }).finally(() => {
        void refresh().finally(() => {
          setDiditSyncing(false);
        });
      });
    }
  }, [hasDiditStatus, refresh, status]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
      <p className="text-sm font-medium">{access.redirectingByRole}</p>
    </div>
  );
}
