'use client';

type VerificationStatusBadgeProps = {
  verified: boolean;
  verifiedLabel: string;
  pendingLabel: string;
};

export function VerificationStatusBadge({
  verified,
  verifiedLabel,
  pendingLabel
}: VerificationStatusBadgeProps) {
  return (
    <span
      className={
        verified
          ? 'inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200'
          : 'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200'
      }
    >
      {verified ? `✓ ${verifiedLabel}` : pendingLabel}
    </span>
  );
}
