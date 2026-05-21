'use client';

import Link from 'next/link';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { LoginForm } from '../auth/LoginForm';
import { LandingHeader } from './LandingHeader';
import { TrustBadges } from './TrustBadges';
import type { SystemRole } from '../../lib/auth/roles';

const ROLE_KEYS: SystemRole[] = ['ADMIN', 'ADVISOR_MANAGER', 'ADVISOR', 'INVESTOR'];

function AccessPageContent() {
  const t = useTranslation();
  const a = t.access;
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const authError = searchParams.get('error');
  const returnTo = searchParams.get('returnTo');
  const callbackUrl = returnTo
    ? `/acceso/callback?returnTo=${encodeURIComponent(returnTo)}`
    : '/acceso/callback';

  const roleLabels = a.roles as Record<SystemRole, string>;
  const isAuthenticated = status === 'authenticated' && session?.user?.accessToken;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingHeader />

      <main className="mx-auto w-full max-w-4xl px-4 py-12 md:px-6 md:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{a.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">{a.subtitle}</p>
        </div>

        {authError ? (
          <p className="mx-auto mt-6 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {a.authError}
          </p>
        ) : null}

        <div className="mt-10 grid grid-cols-1 gap-6 md:mt-12 md:grid-cols-2 md:gap-8">
          <article className="flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-xl font-bold text-slate-900">{a.loginTitle}</h2>
            <p className="mt-3 text-sm text-slate-600">{a.loginDesc}</p>

            {isAuthenticated ? (
              <div className="mt-6 space-y-4">
                <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {a.signedInAs}{' '}
                  <span className="font-semibold">{session?.user?.email}</span>
                  {session?.user?.role ? (
                    <>
                      {' '}
                      · {a.roleLabel}: <span className="font-semibold">{roleLabels[session.user.role]}</span>
                    </>
                  ) : null}
                </p>
                <Link
                  href={returnTo ?? '/marketplace'}
                  className="flex min-h-12 w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-center text-base font-semibold text-white transition hover:bg-blue-600 md:text-sm"
                >
                  {a.continueButton}
                </Link>
              </div>
            ) : (
              <div className="mt-6">
                <LoginForm callbackUrl={callbackUrl} />
              </div>
            )}
          </article>

          <article className="flex w-full flex-col rounded-2xl border border-blue-200 bg-white p-6 shadow-sm ring-1 ring-blue-100 md:p-8">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <UserPlus size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{a.registerTitle}</h2>
            <p className="mt-3 flex-1 text-sm text-slate-600">{a.registerDesc}</p>
            <Link
              href="/kyc?returnTo=/marketplace"
              className="mt-6 flex min-h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-center text-base font-semibold text-white transition hover:bg-blue-500 md:text-sm"
            >
              {a.registerButton}
            </Link>
          </article>
        </div>

        <article className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 md:mt-8 md:p-8">
          <h2 className="text-lg font-bold text-slate-900">{a.rolesTitle}</h2>
          <p className="mt-2 text-sm text-slate-600">{a.rolesDesc}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {ROLE_KEYS.map((role) => (
              <li
                key={role}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <span className="font-semibold text-slate-900">{roleLabels[role]}</span>
                <span className="mt-1 block text-slate-600">{a.roleDescriptions[role]}</span>
              </li>
            ))}
          </ul>
        </article>

        <TrustBadges className="mt-6 justify-center md:mt-8" />

        <article className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 md:mt-8 md:p-8">
          <div className="flex w-full flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{a.kycTitle}</h2>
                <p className="mt-2 text-sm text-slate-600">{a.kycDesc}</p>
              </div>
            </div>
            <Link
              href="/kyc?returnTo=/marketplace"
              className="flex min-h-12 w-full shrink-0 items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-center text-base font-semibold text-slate-900 transition hover:border-blue-500 hover:text-blue-600 md:w-auto md:min-h-0 md:py-2.5 md:text-sm"
            >
              {a.kycButton}
            </Link>
          </div>
        </article>

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
