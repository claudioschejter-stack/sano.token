'use client';

import { BadgeCheck, Link2, Scale } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';

export function TrustStrip() {
  const t = useTranslation();

  const items = [
    { icon: BadgeCheck, label: t.marketplace.trustKyc },
    { icon: Scale, label: t.marketplace.trustRegulation },
    { icon: Link2, label: t.marketplace.trustOnchain }
  ];

  return (
    <div className="mb-8 flex flex-wrap gap-3">
      {items.map(({ icon: Icon, label }) => (
        <span
          key={label}
          className="inline-flex items-center gap-2 rounded-full border border-terminal-border bg-terminal-card px-4 py-2 text-xs font-medium text-terminal-muted"
        >
          <Icon size={14} className="text-terminal-primary" />
          {label}
        </span>
      ))}
    </div>
  );
}
