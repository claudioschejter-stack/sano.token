'use client';

import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { RegisterForm } from '../auth/RegisterForm';
import { DEFAULT_POST_ONBOARDING_PATH } from '../../lib/auth/kycPaths';
import { resolveAuthenticatedDestination, safeReturnTo } from '../../lib/auth/redirects';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { LandingHeader } from './LandingHeader';
import { TrustBadges } from './TrustBadges';

function buildLoginHref(
  returnTo: string,
  email: string,
  staffInvite: boolean,
  inviteError: string | null,
  investorInvite: string
) {
  const params = new URLSearchParams();
  params.set('returnTo', returnTo);
  if (email) {
    params.set('email', email);
  }
  if (staffInvite) {
    params.set('staffInvite', '1');
  }
  if (inviteError) {
    params.set('inviteError', inviteError);
  }
  if (investorInvite) {
    params.set('invite', investorInvite);
  }
  return `/acceso?${params.toString()}`;
}

function RegisterPageContent() {
  const router = useRouter();
  const t = useTranslation();
  const a = t.access;
  const legal = t.legal;
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const inviteEmail = searchParams.get('email')?.trim() ?? '';
  const staffInvite = searchParams.get('staffInvite') === '1';
  const inviteError = searchParams.get('inviteError');
  const investorInvite = searchParams.get('invite')?.trim() ?? '';
  const returnTo = safeReturnTo(searchParams.get('returnTo'), DEFAULT_POST_ONBOARDING_PATH);
  const loginHref = buildLoginHref(returnTo, inviteEmail, staffInvite, inviteError, investorInvite);

  const { isOperational, loading: accountLoading } = useAccountStatus();
  const isAuthenticated = status === 'authenticated' && session?.user?.accessToken;
  const role = session?.user?.role;

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.accessToken || !role) {
      return;
    }

    if (!isOperational) {
      router.replace(loginHref);
      return;
    }

    const destination = resolveAuthenticatedDestination(role, returnTo, isOperational);
    router.replace(destination);
  }, [isOperational, loginHref, returnTo, router, role, session?.user?.accessToken, status]);

  if (status === 'loading' || (isAuthenticated && accountLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <p className="text-sm font-medium">{a.continueButton}…</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingHeader />

      <main className="mx-auto w-full max-w-lg px-4 py-12 md:px-6 md:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{a.registerTitle}</h1>
          <p className="mt-4 whitespace-pre-line text-sm text-slate-600 md:text-base">{a.registerDesc}</p>
        </div>

        {staffInvite ? (
          <p className="mx-auto mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {a.staffInviteAccepted}
          </p>
        ) : null}

        {inviteError ? (
          <p className="mx-auto mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {a.inviteInvalid}
          </p>
        ) : null}

        <article className="mt-10 flex w-full flex-col rounded-2xl border border-blue-200 bg-white p-6 shadow-sm ring-1 ring-blue-100 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <UserPlus size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{a.registerTitle}</h2>
          </div>

          <RegisterForm
            returnTo={returnTo}
            initialEmail={inviteEmail}
            inviteCode={investorInvite}
            loginHref={loginHref}
          />
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

export function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
