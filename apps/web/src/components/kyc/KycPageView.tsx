'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { setDemoKycStatus } from '../../hooks/useKycStatus';
import { useTranslation } from '../../i18n/LocaleProvider';
import { safeReturnTo } from '../../lib/auth/redirects';
import { LandingHeader } from '../landing/LandingHeader';

function KycPageContent() {
  const router = useRouter();
  const t = useTranslation();
  const k = t.kyc;
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'), '/marketplace');

  const completeDemoKyc = () => {
    setDemoKycStatus('APPROVED');
    router.replace(returnTo);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingHeader />

      <main className="mx-auto w-full max-w-xl px-4 py-12 md:px-6 md:py-16">
        <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <ShieldCheck size={24} />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">{k.title}</h1>
          <p className="mt-3 text-sm text-slate-600">{k.description}</p>

          <button
            type="button"
            onClick={completeDemoKyc}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500"
          >
            {k.simulateButton}
          </button>

          <Link
            href={`/acceso?returnTo=${encodeURIComponent(returnTo)}`}
            className="mt-4 block text-center text-sm font-medium text-slate-500 hover:text-blue-600"
          >
            {k.cancel}
          </Link>
        </article>
      </main>
    </div>
  );
}

export function KycPageView() {
  const t = useTranslation();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          <p className="text-sm font-medium">{t.kyc.loading}</p>
        </div>
      }
    >
      <KycPageContent />
    </Suspense>
  );
}
