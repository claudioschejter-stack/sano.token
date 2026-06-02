'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';

type LegalDisclaimerBannerProps = {
  className?: string;
  compact?: boolean;
};

export function LegalDisclaimerBanner({ className = '', compact = false }: LegalDisclaimerBannerProps) {
  const t = useTranslation();
  const l = t.legal;

  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 ${className}`}
      role="note"
      aria-label={l.bannerTitle}
    >
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>{l.bannerTitle}</p>
          <p className={`leading-relaxed text-amber-900 ${compact ? 'text-xs' : 'text-sm'}`}>{l.bannerText}</p>
          {!compact ? (
            <p className="text-xs text-amber-800">
              <Link href="/terminos" className="font-medium underline underline-offset-2 hover:text-amber-950">
                {l.termsLink}
              </Link>
              {' · '}
              <Link href="/privacidad" className="font-medium underline underline-offset-2 hover:text-amber-950">
                {l.privacyLink}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
