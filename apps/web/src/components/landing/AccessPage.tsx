'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { AdaptiveLoginFlow } from '../auth/AdaptiveLoginFlow';
import { MobileAccessLanding } from '../auth/MobileAccessLanding';
import { DEFAULT_POST_ONBOARDING_PATH } from '../../lib/auth/kycPaths';
import { resolveAuthenticatedDestination, safeReturnTo } from '../../lib/auth/redirects';
import { canAccessPortalWithoutInvestorOnboarding } from '../../lib/onboarding/onboardingGate';
import { RegisterForm } from '../auth/RegisterForm';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { useIsPwa } from '../../hooks/useIsPwa';
import { LandingHeader } from './LandingHeader';
import { TrustBadges } from './TrustBadges';

function buildRegisterHref(
  returnTo: string,
  email: string,
  investorInvite: string,
  staffInvite: boolean
) {
  const params = new URLSearchParams();
  params.set('returnTo', returnTo);
  if (email) {
    params.set('email', email);
  }
  if (investorInvite) {
    params.set('invite', investorInvite);
  }
  if (staffInvite) {
    params.set('staffInvite', '1');
  }
  return `/acceso/registro?${params.toString()}`;
}

function AccessPageContent() {
  const router = useRouter();
  const t = useTranslation();
  const a = t.access;
  const legal = t.legal;
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const authError = searchParams.get('error');
  const inviteEmail = searchParams.get('email')?.trim() ?? '';
  const staffInvite = searchParams.get('staffInvite') === '1';
  const investorInviteAccepted = searchParams.get('investorInvite') === '1';
  const inviteError = searchParams.get('inviteError');
  const investorInvite = searchParams.get('invite')?.trim() ?? '';
  const returnTo = safeReturnTo(searchParams.get('returnTo'), DEFAULT_POST_ONBOARDING_PATH);
  const onboardingHref = `/kyc?returnTo=${encodeURIComponent(returnTo)}`;
  const callbackUrl = `/acceso/callback?returnTo=${encodeURIComponent(returnTo)}`;
  const registerHref = buildRegisterHref(returnTo, inviteEmail, investorInvite, staffInvite);

  const { isOperational, loading: accountLoading, profile } = useAccountStatus();
  const isAuthenticated = status === 'authenticated' && session?.user?.accessToken;
  const role = session?.user?.role;
  const registered = searchParams.get('registered') === '1';

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
      isOperational || canAccessPortalWithoutInvestorOnboarding(role)
    );
    router.replace(destination);
  }, [isOperational, returnTo, router, role, session?.user?.accessToken, status]);

  if (status === 'loading' || (isAuthenticated && accountLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-700">
        <p className="text-sm font-medium">{a.continueButton}…</p>
      </div>
    );
  }

  if (isAuthenticated && role && !isOperational && !canAccessPortalWithoutInvestorOnboarding(role)) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <LandingHeader />

        <main className="mx-auto w-full max-w-lg px-4 py-12 md:py-16">
          <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">{a.sessionActiveTitle}</h1>
            <p className="mt-3 text-sm text-slate-600">
              {registered ? a.sessionRegisteredDesc : a.sessionPendingDesc}
            </p>
            <div className="mt-6">
              <RegisterForm profile={profile} returnTo={returnTo} />
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={onboardingHref}
                className="flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-500"
              >
                {a.continueVerification}
              </Link>
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: '/acceso' })}
                className="flex min-h-12 items-center justify-center rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400"
              >
                {a.switchAccount}
              </button>
            </div>
          </article>

          <p className="mt-8 text-center text-sm text-slate-500">
            <Link href="/" className="font-medium text-blue-600 hover:text-blue-500">
              ← {a.backHome}
            </Link>
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <LandingHeader />

      <main className="mx-auto w-full max-w-lg px-4 py-12 md:px-6 md:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{a.title}</h1>
          <p className="mt-4 text-sm text-slate-600 md:text-base">{a.loginDesc}</p>
        </div>

        {authError ? (
          <p className="mx-auto mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {a.authError}
          </p>
        ) : null}

        {inviteError ? (
          <p className="mx-auto mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {a.inviteInvalid}
          </p>
        ) : null}

        {staffInvite ? (
          <p className="mx-auto mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {a.staffInviteAccepted}
          </p>
        ) : null}

        {investorInviteAccepted ? (
          <p className="mx-auto mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {a.investorInviteAccepted}
          </p>
        ) : null}

        <article className="mt-10 flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-bold text-slate-900">{a.loginTitle}</h2>

          <div className="mt-6">
            <AdaptiveLoginFlow
              callbackUrl={callbackUrl}
              initialEmail={inviteEmail}
              registerHref={registerHref}
            />
          </div>
        </article>

        <TrustBadges className="mt-6 justify-center md:mt-8" />

        <p className="mt-8 text-center text-xs leading-relaxed text-slate-500">
          <Link href="/terminos" className="font-medium text-blue-600 hover:text-blue-500">
            {legal.termsLink}
          </Link>
          {' · '}
          <Link href="/privacidad" className="font-medium text-blue-600 hover:text-blue-500">
            {legal.privacyLink}
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-blue-600 hover:text-blue-500">
            ← {a.backHome}
          </Link>
        </p>
      </main>
    </div>
  );
}

export function AccessPage() {
  const isPwa = useIsPwa();

  // Launched from the home-screen icon (or "Abrir la app"): show the app-style
  // login/register shell with a properties teaser instead of the marketing landing.
  if (isPwa) {
    return <MobileAccessLanding />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <AccessPageContent />
    </Suspense>
  );
}
