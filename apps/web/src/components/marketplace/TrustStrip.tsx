'use client';

import { ShieldCheck, Scale, Link2 } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';

const trustItems = [
  { key: 'trustKyc' as const, icon: ShieldCheck },
  { key: 'trustRegulation' as const, icon: Scale },
  { key: 'trustOnchain' as const, icon: Link2 }
];

export function TrustStrip() {
  const t = useTranslation();

  return (
    <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {trustItems.map(({ key, icon: Icon }) => (
        <div
          key={key}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-terminal-border bg-terminal-card px-4 py-2.5 text-center text-sm font-semibold text-terminal-text shadow-sm"
        >
          <Icon size={16} className="shrink-0 text-terminal-primary" aria-hidden />
          <span className="leading-tight">{t.marketplace[key]}</span>
        </div>
      ))}
    </div>
  );
}
