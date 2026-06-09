'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { formatMessage } from '../../i18n';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import type { SystemRole } from '../../lib/auth/roles';
import type { KycStatus } from '@sanova/database';
import { SidebarIdentityDropdown } from './SidebarIdentityDropdown';

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

function firstNameFrom(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

const statusBadgeBase =
  'flex w-full min-w-0 items-center justify-center rounded-lg border px-2 py-1.5 text-center text-xs font-semibold leading-tight';

export function SidebarUserStatus() {
  const t = useTranslation();
  const u = t.userRoleHeader;
  const a = t.accountStatus;
  const { data: session } = useSession();
  const { checklist, profile, loading } = useAccountStatus();

  const role = session?.user?.role as SystemRole | undefined;
  const roleLabels = t.access.roles as Record<SystemRole, string>;

  if (!session?.user || !role) {
    return null;
  }

  const rawName =
    profile?.fullName?.trim() ||
    session.user.name?.trim() ||
    session.user.email?.split('@')[0] ||
    u.fallbackName;
  const displayName = formatMessage(u.welcomeGreeting, { name: firstNameFrom(rawName) });

  const kycStatus = checklist?.kycStatus ?? 'PENDING';
  const kycLabels = a.kycLabels as Record<KycStatus, string>;
  const kycLabel = kycLabels[kycStatus] ?? kycStatus;
  const accountLabels = a.accountLabels as Record<string, string>;
  const accountLabel =
    checklist?.accountStatus === 'SUSPENDED'
      ? accountLabels.SUSPENDED
      : checklist?.operational
        ? accountLabels.OPERATIONAL
        : accountLabels.ONBOARDING;

  return (
    <div className="w-full space-y-2 pb-2">
      <p className="text-center text-sm font-semibold leading-snug text-terminal-text">{displayName}</p>
      <div className="grid w-full grid-cols-2 gap-2">
        <span
          className={`${statusBadgeBase} border-terminal-primary/40 bg-terminal-primary/10 text-terminal-primary`}
        >
          {roleLabels[role] ?? role}
        </span>
        {!loading && checklist ? (
          <>
            <span className={`${statusBadgeBase} ${kycBadgeClass(kycStatus)}`}>
              {u.kycPrefix}: {kycLabel}
            </span>
            <span
              className={`${statusBadgeBase} ${
                checklist.operational
                  ? 'border-terminal-success/30 bg-terminal-success/10 text-terminal-success'
                  : 'border-terminal-border bg-terminal-bg text-terminal-muted'
              }`}
            >
              {accountLabel}
            </span>
            <SidebarIdentityDropdown className={statusBadgeBase} />
          </>
        ) : null}
      </div>
      {!loading && checklist && !checklist.operational && checklist.accountStatus !== 'SUSPENDED' ? (
        <Link
          href="/kyc"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-terminal-primary hover:underline"
        >
          <ShieldCheck size={14} />
          {a.continueCta}
        </Link>
      ) : null}
    </div>
  );
}
