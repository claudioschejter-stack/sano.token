'use client';

import Link from 'next/link';
import { LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { LandingHeader } from './LandingHeader';

export function AccessPage() {
  const t = useTranslation();
  const a = t.access;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingHeader />

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{a.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">{a.subtitle}</p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <LogIn size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{a.loginTitle}</h2>
            <p className="mt-3 flex-1 text-sm text-slate-600">{a.loginDesc}</p>
            <Link
              href="/marketplace"
              className="mt-6 block w-full rounded-lg bg-slate-900 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              {a.loginButton}
            </Link>
          </article>

          <article className="flex flex-col rounded-2xl border border-blue-200 bg-white p-8 shadow-sm ring-1 ring-blue-100">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <UserPlus size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{a.registerTitle}</h2>
            <p className="mt-3 flex-1 text-sm text-slate-600">{a.registerDesc}</p>
            <Link
              href="/kyc?returnTo=/marketplace"
              className="mt-6 block w-full rounded-lg bg-blue-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              {a.registerButton}
            </Link>
          </article>
        </div>

        <article className="mt-8 rounded-2xl border border-slate-200 bg-white p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
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
              className="shrink-0 rounded-lg border border-slate-300 px-5 py-2.5 text-center text-sm font-semibold text-slate-900 transition hover:border-blue-500 hover:text-blue-600"
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
