'use client';

import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { LoginForm } from '../auth/LoginForm';
import { DEFAULT_POST_ONBOARDING_PATH } from '../../lib/auth/kycPaths';
import { resolveAuthenticatedDestination, safeReturnTo } from '../../lib/auth/redirects';
import { RegisterForm } from '../auth/RegisterForm';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { LandingHeader } from './LandingHeader';
import { TrustBadges } from './TrustBadges';

function AccessPageContent() {
  const router = useRouter();
  const t = useTranslation();
  const a = t.access;
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const authError = searchParams.get('error');
  const inviteEmail = searchParams.get('email')?.trim() ?? '';
  const staffInvite = searchParams.get('staffInvite') === '1';
  const inviteError = searchParams.get('inviteError');
  const returnTo = safeReturnTo(searchParams.get('returnTo'), DEFAULT_POST_ONBOARDING_PATH);
  const onboardingHref = `/kyc?returnTo=${encodeURIComponent(returnTo)}`;
  const callbackUrl = `/acceso/callback?returnTo=${encodeURIComponent(returnTo)}`;

  const { isOperational, loading: accountLoading, profile } = useAccountStatus();
  const isAuthenticated = status === 'authenticated' && session?.user?.accessToken;
  const role = session?.user?.role;
  const registered = searchParams.get('registered') === '1';

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.accessToken || !role) {
      return;
    }

    if (!isOperational) {
      return;
    }

    const destination = resolveAuthenticatedDestination(role, returnTo, isOperational);
    router.replace(destination);
  }, [isOperational, returnTo, router, role, session?.user?.accessToken, status]);

  if (status === 'loading' || (isAuthenticated && accountLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <p className="text-sm font-medium">{a.continueButton}…</p>
      </div>
    );
  }

  if (isAuthenticated && role && !isOperational) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <LandingHeader />

        <main className="mx-auto w-full max-w-lg px-4 py-12 md:py-16">
          <article className="rounded-2xl border border-blue-200 bg-white p-8 shadow-sm">
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingHeader />

      <main className="mx-auto w-full max-w-4xl px-4 py-12 md:px-6 md:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{a.title}</h1>
        </div>

        {authError ? (
          <p className="mx-auto mt-6 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {a.authError}
          </p>
        ) : null}

        {inviteError ? (
          <p className="mx-auto mt-6 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {a.inviteInvalid}
          </p>
        ) : null}

        {staffInvite ? (
          <p className="mx-auto mt-6 max-w-2xl rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {a.staffInviteAccepted}
          </p>
        ) : null}

        <div className="mt-10 grid grid-cols-1 gap-6 md:mt-12 md:grid-cols-2 md:gap-8">
          <article className="flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-xl font-bold text-slate-900">{a.loginTitle}</h2>
            <p className="mt-3 text-sm text-slate-600">{a.loginDesc}</p>

            <div className="mt-6">
              <LoginForm callbackUrl={callbackUrl} initialEmail={inviteEmail} />
            </div>
          </article>

          <article className="flex w-full flex-col rounded-2xl border border-blue-200 bg-white p-6 shadow-sm ring-1 ring-blue-100 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <UserPlus size={24} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">{a.registerTitle}</h2>
            </div>
            <p className="whitespace-pre-line text-sm text-slate-600">{a.registerDesc}</p>
            <div className="mt-6">
              <RegisterForm returnTo={returnTo} initialEmail={inviteEmail} />
            </div>
          </article>
        </div>

        <TrustBadges className="mt-6 justify-center md:mt-8" />

        <p className="mt-10 text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-blue-600 hover:text-blue-500">
            ← {a.backHome}
          </Link>
        </p>
      </main>
    </div>
  );
}

export function AccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <AccessPageContent />
    </Suspense>
  );
}
