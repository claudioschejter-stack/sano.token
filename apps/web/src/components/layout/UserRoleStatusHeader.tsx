'use client';

import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import type { SystemRole } from '../../lib/auth/roles';

export function UserRoleStatusHeader() {
  const t = useTranslation();
  const { data: session } = useSession();
  const { checklist, profile } = useAccountStatus();

  const role = session?.user?.role as SystemRole | undefined;
  const roleLabels = t.access.roles as Record<SystemRole, string>;

  if (!session?.user || !role) {
    return null;
  }

  const displayName =
    profile?.fullName?.trim() ||
    session.user.name?.trim() ||
    session.user.email?.split('@')[0] ||
    t.userRoleHeader.fallbackName;

  const kycApproved = checklist?.kycApproved ?? false;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-terminal-border pb-4 text-sm">
      <span className="font-semibold text-terminal-text">{displayName}</span>
      <span className="rounded-full border border-terminal-border bg-terminal-bg px-2.5 py-1 text-xs font-semibold text-terminal-muted">
        {roleLabels[role] ?? role}
      </span>
      {kycApproved ? (
        <span className="rounded-full border border-terminal-success/30 bg-terminal-success/10 px-2.5 py-1 text-xs font-semibold text-terminal-success">
          {t.userRoleHeader.approvedStatus}
        </span>
      ) : null}
    </div>
  );
}
