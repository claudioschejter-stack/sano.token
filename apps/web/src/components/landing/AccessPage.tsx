'use client';

import Link from 'next/link';
import { LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { LandingHeader } from './LandingHeader';
import { TrustBadges } from './TrustBadges';

export function AccessPage() {
  const t = useTranslation();
  const a = t.access;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingHeader />

      <main className="mx-auto w-full max-w-4xl px-4 py-12 md:px-6 md:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{a.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">{a.subtitle}</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:mt-12 md:grid-cols-2 md:gap-8">
          <article className="flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <LogIn size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{a.loginTitle}</h2>
            <p className="mt-3 flex-1 text-sm text-slate-600">{a.loginDesc}</p>
            <Link
              href="/marketplace"
              className="mt-6 flex min-h-12 w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-center text-base font-semibold text-white transition hover:bg-blue-600 md:text-sm"
            >
              {a.loginButton}
            </Link>
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
