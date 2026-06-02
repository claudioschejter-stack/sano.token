'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import type { KycStatus } from '@sanova/database';

type AccountStatusBannerProps = {
  className?: string;
  /** When true, also show a compact success strip for operational accounts. */
  showWhenOperational?: boolean;
};

function kycBadgeClass(status: KycStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'border-terminal-success/30 bg-terminal-success/10 text-terminal-success';
    case 'REJECTED':
      return 'border-terminal-danger/30 bg-terminal-danger/10 text-terminal-danger';
    default:
      return 'border-terminal-warning/30 bg-terminal-warning/10 text-terminal-warning';
  }
}

export function AccountStatusBanner({ className = '', showWhenOperational = false }: AccountStatusBannerProps) {
  const t = useTranslation();
  const a = t.accountStatus;
  const pathname = usePathname();
  const { checklist, loading, isOperational, systemRole } = useAccountStatus();

  if (loading || !checklist) {
    return null;
  }

  if (pathname.startsWith('/kyc')) {
    return null;
  }

  const kycLabels = a.kycLabels as Record<KycStatus, string>;
  const kycLabel = kycLabels[checklist.kycStatus] ?? checklist.kycStatus;
  const returnTo = encodeURIComponent(pathname);
  const kycHref = `/kyc?returnTo=${returnTo}`;

  if (checklist.accountStatus === 'SUSPENDED') {
    return (
      <div
        className={`flex flex-wrap items-start gap-3 rounded-xl border border-terminal-danger/40 bg-terminal-danger/10 px-4 py-3 md:items-center md:justify-between ${className}`}
        role="status"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 shrink-0 text-terminal-danger" size={20} />
          <div>
            <p className="text-sm font-semibold text-terminal-text">{a.suspendedTitle}</p>
            <p className="mt-1 text-sm text-terminal-muted">{a.suspendedDesc}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isOperational && systemRole === 'INVESTOR' && !checklist.walletLinked) {
    return (
      <div
        className={`flex flex-wrap items-start gap-3 rounded-xl border border-terminal-warning/40 bg-terminal-warning/10 px-4 py-3 md:items-center md:justify-between ${className}`}
        role="status"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-terminal-warning" size={20} />
          <div>
            <p className="text-sm font-semibold text-terminal-text">{a.walletRequiredTitle}</p>
            <p className="mt-1 text-sm text-terminal-muted">{a.walletRequiredDesc}</p>
          </div>
        </div>
        <Link
          href={kycHref}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-2 text-sm font-semibold text-terminal-primary transition hover:bg-terminal-primary/20"
        >
          <ShieldCheck size={16} />
          {a.walletRequiredCta}
        </Link>
      </div>
    );
  }

  if (isOperational) {
    if (!showWhenOperational) {
      return null;
    }

    return (
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl border border-terminal-success/30 bg-terminal-success/5 px-4 py-3 ${className}`}
        role="status"
      >
        <CheckCircle2 className="shrink-0 text-terminal-success" size={20} />
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-terminal-text">{a.operationalTitle}</p>
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${kycBadgeClass('APPROVED')}`}
          >
            {kycLabel}
          </span>
        </div>
      </div>
    );
  }

  const nextStep = !checklist.contactVerified
    ? a.stepContact
    : !checklist.kycApproved
      ? checklist.kycStatus === 'REJECTED'
        ? a.stepKycRejected
        : a.stepKyc
      : a.stepReview;

  const isRejected = checklist.kycStatus === 'REJECTED';
  const borderClass = isRejected
    ? 'border-terminal-danger/40 bg-terminal-danger/10'
    : 'border-terminal-warning/40 bg-terminal-warning/10';
  const iconClass = isRejected ? 'text-terminal-danger' : 'text-terminal-warning';
  const Icon = isRejected ? ShieldAlert : AlertTriangle;

  return (
    <div
      className={`flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 md:items-center md:justify-between ${borderClass} ${className}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 shrink-0 ${iconClass}`} size={20} />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-terminal-text">{a.pendingTitle}</p>
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${kycBadgeClass(checklist.kycStatus)}`}
            >
              {kycLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-terminal-muted">{nextStep}</p>
        </div>
      </div>
      <Link
        href={kycHref}
        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-2 text-sm font-semibold text-terminal-primary transition hover:bg-terminal-primary/20"
      >
        <ShieldCheck size={16} />
        {a.continueCta}
      </Link>
    </div>
  );
}
