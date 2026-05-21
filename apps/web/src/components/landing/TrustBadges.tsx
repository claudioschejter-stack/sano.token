'use client';

import { useTranslation } from '../../i18n/LocaleProvider';

function OnChainIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
      <path
        d="M4 12h6l2 8 4-16 2 8h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LegalAuditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
      <path
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ComplianceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
      <path
        d="M12 3l7 4v5c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V7l7-4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const BADGE_ICONS = [OnChainIcon, LegalAuditIcon, ComplianceIcon] as const;

type TrustBadgesProps = {
  variant?: 'light' | 'dark';
  className?: string;
};

export function TrustBadges({ variant = 'light', className = '' }: TrustBadgesProps) {
  const items = useTranslation().landing.trustBadges;

  const isDark = variant === 'dark';

  return (
    <ul
      className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2 ${className}`}
      aria-label={items.ariaLabel}
    >
      {items.labels.map((label, index) => {
        const Icon = BADGE_ICONS[index] ?? OnChainIcon;

        return (
          <li
            key={label}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium tracking-wide ${
              isDark
                ? 'border-white/10 bg-white/5 text-slate-300'
                : 'border-slate-200/80 bg-slate-50/90 text-slate-600'
            }`}
          >
            <span
              className={
                isDark
                  ? 'text-blue-300/90'
                  : 'text-blue-700/80'
              }
            >
              <Icon />
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
