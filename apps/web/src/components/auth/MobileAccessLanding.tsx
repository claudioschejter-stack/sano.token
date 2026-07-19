'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { AdaptiveLoginFlow } from './AdaptiveLoginFlow';
import { OnboardingResumeCard } from './OnboardingResumeCard';
import { MobileAuthShell } from './MobileAuthShell';
import { AuthSplash } from './AuthSplash';
import { PasskeyLoginButton } from './PasskeyLoginButton';
import { getDevicePasskeyHint } from '../../lib/auth/devicePasskeyStorage';
import { resolveAccessPageError } from '../../lib/auth/accessPageErrors';
import { DEFAULT_POST_ONBOARDING_PATH } from '../../lib/auth/kycPaths';
import { resolveAuthenticatedDestination, safeReturnTo } from '../../lib/auth/redirects';
import { canAccessPortalWithoutInvestorOnboarding } from '../../lib/onboarding/onboardingGate';
import { useMobilePortal } from '../../hooks/useMobilePortal';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { PwaPropertyCarousel } from '../pwa/PwaPropertyCarousel';
import { TrustBadges } from '../landing/TrustBadges';

function buildRegisterHref(
  returnTo: string,
  email: string,
  investorInvite: string,
  staffInvite: boolean
) {
  const params = new URLSearchParams();
  params.set('returnTo', returnTo);
  if (email) params.set('email', email);
  if (investorInvite) params.set('invite', investorInvite);
  if (staffInvite) params.set('staffInvite', '1');
  return `/acceso/registro?${params.toString()}`;
}

function MobileAccessLandingContent() {
  const router = useRouter();
  const t = useTranslation();
  const a = t.access;
  const legal = t.legal;
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const authError = searchParams.get('error');
  const signedOut = searchParams.get('signedOut') === '1';
  const accessErrorMessage = resolveAccessPageError(authError, {
    authError: a.authError,
    investorAccessNotEnabled: a.investorAccessNotEnabled,
    accountLocked: a.accountLocked,
    register: a.register
  });
  const inviteEmail = searchParams.get('email')?.trim() ?? '';
  const staffInvite = searchParams.get('staffInvite') === '1';
  const investorInviteAccepted = searchParams.get('investorInvite') === '1';
  const inviteError = searchParams.get('inviteError');
  const investorInvite = searchParams.get('invite')?.trim() ?? '';
  const returnTo = safeReturnTo(searchParams.get('returnTo'), DEFAULT_POST_ONBOARDING_PATH);
  const callbackUrl = `/acceso/callback?returnTo=${encodeURIComponent(returnTo)}`;
  const registerHref = buildRegisterHref(returnTo, inviteEmail, investorInvite, staffInvite);
  const registered = searchParams.get('registered') === '1';

  const { isOperational, loading: accountLoading } = useAccountStatus();
  const isMobilePortal = useMobilePortal();
  const isAuthenticated = status === 'authenticated' && session?.user?.accessToken;
  const role = session?.user?.role;
  const passkeyHint = useMemo(() => getDevicePasskeyHint(), []);
  const hasConfiguredPasskey = Boolean(passkeyHint?.credentialId);
  const [biometricSplashSkipped, setBiometricSplashSkipped] = useState(false);
  const hasContextualMessage = Boolean(
    accessErrorMessage || inviteError || staffInvite || investorInviteAccepted || registered
  );
  // After logout we stay on splash quietly — never auto-trigger WebAuthn (that caused the loop).
  const showBiometricSplash =
    status === 'unauthenticated' &&
    isMobilePortal &&
    !biometricSplashSkipped &&
    !hasContextualMessage;

  useEffect(() => {
    if (searchParams.get('tab') === 'register') {
      router.replace(registerHref);
    }
  }, [registerHref, router, searchParams]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.accessToken || !role) {
      return;
    }

    if (!isOperational && !canAccessPortalWithoutInvestorOnboarding(role)) {
      return;
    }

    const destination = resolveAuthenticatedDestination(
      role,
      returnTo,
      isOperational || canAccessPortalWithoutInvestorOnboarding(role),
      { isMobile: isMobilePortal }
    );
    router.replace(destination);
  }, [isMobilePortal, isOperational, returnTo, router, role, session?.user?.accessToken, status]);

  if (status === 'loading' || (isAuthenticated && accountLoading)) {
    return <AuthSplash variant="loading" />;
  }

  if (showBiometricSplash) {
    const autoTrigger = hasConfiguredPasskey && !signedOut;
    const splashVariant = signedOut ? 'logout' : 'access';

    return (
      <div className="relative min-h-[100dvh] w-full">
        <AuthSplash variant={splashVariant} />
        {signedOut ? (
          <p
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 text-center font-semibold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
            style={{ fontSize: 'calc(0.875rem * 2.25)' }}
          >
            {a.sessionClosed}
          </p>
        ) : null}
        <div
          className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-4 px-8"
          style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}
        >
          <PasskeyLoginButton
            email={passkeyHint?.email ?? ''}
            callbackUrl={callbackUrl}
            autoTrigger={autoTrigger}
            hideWhenConfigured={false}
            variant="splash"
            className="w-full max-w-xs"
          />
          <button
            type="button"
            onClick={() => setBiometricSplashSkipped(true)}
            className="text-sm font-medium text-white/70 transition hover:text-white"
          >
            {a.mobileGateSkip}
          </button>
        </div>
      </div>
    );
  }

  if (isAuthenticated && role && !isOperational && !canAccessPortalWithoutInvestorOnboarding(role)) {
    return (
      <MobileAuthShell title={a.sessionActiveTitle} subtitle={registered ? a.sessionRegisteredDesc : a.sessionPendingDesc}>
        <OnboardingResumeCard returnTo={returnTo} registered={registered} />
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/acceso?signedOut=1' })}
            className="flex min-h-14 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
          >
            {a.switchAccount}
          </button>
        </div>
      </MobileAuthShell>
    );
  }

  return (
    <MobileAuthShell title={a.title} subtitle={a.loginDesc}>
      {accessErrorMessage ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {accessErrorMessage}
        </p>
      ) : null}
      {inviteError ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {a.inviteInvalid}
        </p>
      ) : null}
      {staffInvite ? (
        <p className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {a.staffInviteAccepted}
        </p>
      ) : null}
      {investorInviteAccepted ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {a.investorInviteAccepted}
        </p>
      ) : null}

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <AdaptiveLoginFlow
          callbackUrl={callbackUrl}
          initialEmail={inviteEmail || passkeyHint?.email || ''}
          registerHref={registerHref}
          skipPasskeyAutoTrigger
        />
      </div>

      <TrustBadges className="mt-6 justify-center" />

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
        <Link href="/terminos" className="font-medium text-blue-600 hover:text-blue-500">
          {legal.termsLink}
        </Link>
        {' · '}
        <Link href="/privacidad" className="font-medium text-blue-600 hover:text-blue-500">
          {legal.privacyLink}
        </Link>
      </p>

      <div className="-mx-6 mt-8">
        <PwaPropertyCarousel title={a.availableProperties} limit={4} compact showViewAll={false} />
      </div>
    </MobileAuthShell>
  );
}

export function MobileAccessLanding() {
  return (
    <Suspense fallback={<AuthSplash variant="loading" />}>
      <MobileAccessLandingContent />
    </Suspense>
  );
}
