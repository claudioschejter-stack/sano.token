'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { AdaptiveLoginFlow } from './AdaptiveLoginFlow';
import { RegisterForm } from './RegisterForm';
import { MobileAuthShell } from './MobileAuthShell';
import { DEFAULT_POST_ONBOARDING_PATH } from '../../lib/auth/kycPaths';
import { resolveAuthenticatedDestination, safeReturnTo } from '../../lib/auth/redirects';
import { canAccessPortalWithoutInvestorOnboarding } from '../../lib/onboarding/onboardingGate';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type Tab = 'login' | 'register';

type MobileAccessLandingProps = {
  defaultTab?: Tab;
};

function buildRegisterHref(
  returnTo: string,
  email: string,
  investorInvite: string,
  staffInvite: boolean
) {
  const params = new URLSearchParams();
  params.set('returnTo', returnTo);
  params.set('tab', 'register');
  if (email) params.set('email', email);
  if (investorInvite) params.set('invite', investorInvite);
  if (staffInvite) params.set('staffInvite', '1');
  return `/acceso?${params.toString()}`;
}

function MobileAccessLandingContent({ defaultTab = 'login' }: MobileAccessLandingProps) {
  const router = useRouter();
  const t = useTranslation();
  const a = t.access;
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const initialTab =
    searchParams.get('tab') === 'register' || defaultTab === 'register' ? 'register' : 'login';
  const [tab, setTab] = useState<Tab>(initialTab);

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
  const registered = searchParams.get('registered') === '1';

  const { isOperational, loading: accountLoading, profile } = useAccountStatus();
  const isAuthenticated = status === 'authenticated' && session?.user?.accessToken;
  const role = session?.user?.role;

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

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
      <MobileAuthShell>
        <p className="py-16 text-center text-sm text-slate-500">{a.continueButton}…</p>
      </MobileAuthShell>
    );
  }

  if (isAuthenticated && role && !isOperational && !canAccessPortalWithoutInvestorOnboarding(role)) {
    return (
      <MobileAuthShell title={a.sessionActiveTitle} subtitle={registered ? a.sessionRegisteredDesc : a.sessionPendingDesc}>
        <RegisterForm profile={profile} returnTo={returnTo} />
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={onboardingHref}
            className="flex min-h-14 items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: MP_ACCENT }}
          >
            {a.continueVerification}
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/acceso' })}
            className="flex min-h-14 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
          >
            {a.switchAccount}
          </button>
        </div>
      </MobileAuthShell>
    );
  }

  return (
    <MobileAuthShell
      title={tab === 'login' ? a.title : a.registerTitle}
      subtitle={tab === 'login' ? a.loginDesc : a.registerDesc}
    >
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab('login')}
          className={`min-h-12 rounded-xl text-sm font-semibold transition ${
            tab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          Ingresar
        </button>
        <button
          type="button"
          onClick={() => setTab('register')}
          className={`min-h-12 rounded-xl text-sm font-semibold transition ${
            tab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          Crear cuenta
        </button>
      </div>

      {authError ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {a.authError}
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
        {tab === 'login' ? (
          <AdaptiveLoginFlow
            callbackUrl={callbackUrl}
            initialEmail={inviteEmail}
            registerHref={registerHref}
          />
        ) : (
          <RegisterForm
            returnTo={returnTo}
            initialEmail={inviteEmail}
            inviteCode={investorInvite}
            loginHref={`/acceso?returnTo=${encodeURIComponent(returnTo)}`}
          />
        )}
      </div>
    </MobileAuthShell>
  );
}

export function MobileAccessLanding({ defaultTab = 'login' }: MobileAccessLandingProps) {
  return (
    <Suspense
      fallback={
        <MobileAuthShell>
          <p className="py-16 text-center text-sm text-slate-500">Cargando…</p>
        </MobileAuthShell>
      }
    >
      <MobileAccessLandingContent defaultTab={defaultTab} />
    </Suspense>
  );
}
