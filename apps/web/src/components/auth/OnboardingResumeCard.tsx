'use client';

import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { buildKycUrl } from '../../lib/auth/kycPaths';
import { requiresInvestorStyleOnboarding } from '../../lib/onboarding/onboardingGate';
import { resolveOnboardingStepParam } from '../../lib/onboarding/resolveOnboardingStepParam';

type OnboardingResumeCardProps = {
  returnTo: string;
  /** Shown when the user just finished step 1 (account creation). */
  registered?: boolean;
  className?: string;
};

export function OnboardingResumeCard({
  returnTo,
  registered = false,
  className = ''
}: OnboardingResumeCardProps) {
  const t = useTranslation();
  const r = t.access.onboardingResume;
  const o = t.onboarding;
  const { checklist, loading, fetchError, refresh, systemRole } = useAccountStatus();

  if (loading && !checklist) {
    return <p className={`text-sm text-slate-500 ${className}`}>{o.loading}</p>;
  }

  if (!checklist) {
    return (
      <div className={`space-y-3 ${className}`}>
        <p className="text-sm text-slate-600">
          {fetchError ? o.statusLoadFailed : o.loading}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          {o.statusRetry}
        </button>
      </div>
    );
  }

  const investorOnboarding = requiresInvestorStyleOnboarding(systemRole);
  const pendingStep = resolveOnboardingStepParam(checklist, investorOnboarding);
  const onboardingHref = pendingStep
    ? buildKycUrl(returnTo, undefined, pendingStep)
    : buildKycUrl(returnTo);

  const steps = [
    { label: r.stepContact, done: checklist.emailVerified && checklist.contactVerified },
    { label: r.stepKyc, done: checklist.kycApproved },
    ...(investorOnboarding
      ? [
          { label: r.stepWallet, done: checklist.walletLinked },
          { label: r.stepTotp, done: checklist.totpEnabled }
        ]
      : [])
  ];

  const completedCount = steps.filter((step) => step.done).length;
  const nextStep = steps.find((step) => !step.done);
  const remainingMinutes = Math.max(Math.ceil((steps.length - completedCount) * 2.5), 0);

  return (
    <div className={`space-y-5 ${className}`}>
      {registered ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {r.registeredBanner}
        </p>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{r.phaseLabel}</p>
        <p className="mt-1 text-sm text-slate-600">{r.progressHint}</p>
      </div>

      <ul className="space-y-3" aria-label={r.checklistAria}>
        {steps.map((step) => (
          <li key={step.label} className="flex items-start gap-3 text-sm">
            {step.done ? (
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} aria-hidden />
            ) : (
              <Circle className="mt-0.5 shrink-0 text-slate-300" size={18} aria-hidden />
            )}
            <span className={step.done ? 'text-slate-600 line-through' : 'font-medium text-slate-900'}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex gap-1.5" aria-hidden>
        {steps.map((step, index) => (
          <div
            key={`progress-${index}`}
            className={`h-1.5 flex-1 rounded-full ${step.done ? 'bg-blue-600' : 'bg-slate-200'}`}
          />
        ))}
      </div>

      <p className="text-xs text-slate-500">
        {r.stepsCompleted.replace('{done}', String(completedCount)).replace('{total}', String(steps.length))}
      </p>

      {remainingMinutes > 0 ? (
        <p className="text-xs font-medium text-slate-600">
          {r.timeRemaining.replace('{minutes}', String(remainingMinutes))}
        </p>
      ) : null}

      {nextStep ? (
        <p className="text-sm font-medium text-slate-800">
          {r.nextStepHint.replace('{step}', nextStep.label)}
        </p>
      ) : null}

      <Link
        href={onboardingHref}
        className="flex min-h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-500"
      >
        {r.continueCta}
      </Link>
    </div>
  );
}
