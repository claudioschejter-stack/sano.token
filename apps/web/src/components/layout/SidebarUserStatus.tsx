'use client';

import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import type { SystemRole } from '../../lib/auth/roles';

export function SidebarUserStatus() {
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
    <div className="space-y-2 px-1 pb-2">
      <p className="text-sm font-semibold leading-snug text-terminal-text">{displayName}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full border border-terminal-primary/40 bg-terminal-bg px-2.5 py-0.5 text-xs font-semibold text-terminal-primary">
          {roleLabels[role] ?? role}
        </span>
        {kycApproved ? (
          <span className="inline-flex rounded-full border border-terminal-success/30 bg-terminal-success/10 px-2.5 py-0.5 text-xs font-semibold text-terminal-success">
            {t.userRoleHeader.approvedStatus}
          </span>
        ) : null}
      </div>
    </div>
  );
}
