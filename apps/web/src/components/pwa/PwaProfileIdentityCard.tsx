'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { KycStatus } from '@sanova/database';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { buildKycUrl, DEFAULT_POST_ONBOARDING_PATH } from '../../lib/auth/kycPaths';
import { requiresInvestorStyleOnboarding } from '../../lib/onboarding/onboardingGate';
import { resolveOnboardingStepParam } from '../../lib/onboarding/resolveOnboardingStepParam';

function statusBadgeClass(status: KycStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'REJECTED':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-800';
  }
}

/** Compact account / identity status for PWA Perfil (security settings). */
export function PwaProfileIdentityCard() {
  const t = useTranslation();
  const a = t.accountStatus;
  const p = t.pwaHome;
  const pathname = usePathname();
  const { checklist, loading, isOperational, systemRole } = useAccountStatus();

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
        <div className="mt-3 h-10 animate-pulse rounded-xl bg-slate-100" />
      </section>
    );
  }

  if (!checklist) {
    return null;
  }

  const kycLabels = a.kycLabels as Record<KycStatus, string>;
  const identityLabel = kycLabels[checklist.kycStatus] ?? checklist.kycStatus;
  const investorOnboarding = requiresInvestorStyleOnboarding(systemRole);
  const pendingStep = resolveOnboardingStepParam(checklist, investorOnboarding);

  function onboardingHref(step = pendingStep) {
    return step
      ? buildKycUrl(pathname, DEFAULT_POST_ONBOARDING_PATH, step)
      : buildKycUrl(pathname);
  }

  if (checklist.accountStatus === 'SUSPENDED') {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm" role="status">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 shrink-0 text-red-600" size={20} />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{p.profileAccountTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">{a.suspendedDesc}</p>
          </div>
        </div>
      </section>
    );
  }

  if (isOperational) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm" role="status">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900">{p.profileAccountTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">{a.operationalTitle}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass('APPROVED')}`}
              >
                {p.profileIdentityLabel}: {identityLabel}
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (checklist.kycApproved && !checklist.walletLinked) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm" role="status">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900">{p.profileAccountTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">{a.walletRequiredDesc}</p>
            <Link
              href={onboardingHref('wallet')}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#009EE3] px-4 py-3 text-sm font-semibold text-white"
            >
              <ShieldCheck size={16} />
              {a.walletRequiredCta}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" role="status">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-[#009EE3]" size={20} />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">{p.profileAccountTitle}</h2>
          <p className="mt-1 text-sm text-slate-600">{p.profileAccountPendingHint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(checklist.kycStatus)}`}
            >
              {p.profileIdentityLabel}: {identityLabel}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {p.profileActivationPending}
            </span>
          </div>
          <Link
            href={onboardingHref()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#009EE3] px-4 py-3 text-sm font-semibold text-white"
          >
            <ShieldCheck size={16} />
            {p.profileContinueVerification}
          </Link>
        </div>
      </div>
    </section>
  );
}
