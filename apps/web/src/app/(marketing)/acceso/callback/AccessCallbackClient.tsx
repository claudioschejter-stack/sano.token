'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../../i18n/LocaleProvider';
import { resolveAuthenticatedDestination } from '../../../../lib/auth/redirects';
import type { SystemRole } from '../../../../lib/auth/roles';
import { buildKycUrl, DEFAULT_POST_ONBOARDING_PATH } from '../../../../lib/auth/kycPaths';
import { useAccountStatus } from '../../../../hooks/useAccountStatus';
import { useDeviceDetection } from '../../../../hooks/useDeviceDetection';
import { getDevicePasskeyHint } from '../../../../lib/auth/devicePasskeyStorage';
import { hasBiometricPromptBeenShown, markBiometricPromptShown } from '../../../../lib/auth/biometricPromptStorage';
import { BiometricOnboardingStep } from '../../../../components/auth/BiometricOnboardingStep';
import { InstallAppBanner } from '../../../../components/pwa/InstallAppBanner';

export default function AccessCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const access = useTranslation().access;
  const { isOperational, loading, refresh, checklist } = useAccountStatus();
  const { isMobile } = useDeviceDetection();
  const diditSyncStarted = useRef(false);
  const [diditSyncing, setDiditSyncing] = useState(false);
  const [totpPendingSetup, setTotpPendingSetup] = useState<boolean | null>(null);
  const [biometricGate, setBiometricGate] = useState<{ destination: string } | null>(null);
  const hasDiditStatus = searchParams.has('status') || searchParams.has('verificationSessionId');

  useEffect(() => {
    if (status !== 'authenticated') {
      setTotpPendingSetup(null);
      return;
    }

    void fetch('/api/auth/totp/status', { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { pendingSetup?: boolean } | null) => {
        setTotpPendingSetup(Boolean(data?.pendingSetup));
      })
      .catch(() => setTotpPendingSetup(false));
  }, [status]);

  useEffect(() => {
    if (status === 'loading' || biometricGate) {
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

    if (needsTotpStep && totpPendingSetup === null) {
      return;
    }

    const destination = needsTotpStep
      ? buildKycUrl(returnTo, DEFAULT_POST_ONBOARDING_PATH, 'totp', {
          totpMode: totpPendingSetup ? 'confirm' : undefined
        })
      : resolveAuthenticatedDestination(role, returnTo, isOperational);

    // First successful login on this phone with email/password (not needing KYC/TOTP
    // setup): offer to enable biometric unlock once, like Mercado Pago does.
    const email = session?.user?.email?.trim().toLowerCase() ?? '';
    if (
      !needsTotpStep &&
      isMobile &&
      email &&
      !getDevicePasskeyHint()?.credentialId &&
      !hasBiometricPromptBeenShown(email)
    ) {
      setBiometricGate({ destination });
      return;
    }

    router.replace(destination);
  }, [
    biometricGate,
    checklist?.kycApproved,
    checklist?.totpEnabled,
    checklist?.walletLinked,
    diditSyncing,
    hasDiditStatus,
    isMobile,
    isOperational,
    loading,
    router,
    searchParams,
    session?.authError,
    session?.user?.email,
    session?.user?.pendingTotpToken,
    session?.user?.role,
    session?.user?.totpPending,
    status,
    totpPendingSetup
  ]);

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

  if (biometricGate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12 text-slate-700">
        <div className="w-full max-w-md">
          <InstallAppBanner />
          <BiometricOnboardingStep
            onComplete={() => {
              const email = session?.user?.email?.trim().toLowerCase();
              if (email) {
                markBiometricPromptShown(email);
              }
              router.replace(biometricGate.destination);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-slate-700">
      <p className="text-sm font-medium">{access.redirectingByRole}</p>
    </div>
  );
}
