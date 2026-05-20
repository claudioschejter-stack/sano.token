'use client';

import { Radio } from 'lucide-react';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { useDividendStore } from '../../store/useDividendStore';

export function LiveDividendStream() {
  const t = useTranslation();
  const { intlLocale } = useLocale();
  const lastLiveAt = useDividendStore((state) => state.lastLiveAt);

  if (!lastLiveAt) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-terminal-success/30 bg-terminal-success/10 px-4 py-2 text-xs text-terminal-success">
      <Radio size={14} className="animate-pulse" />
      <span>
        {t.dashboard.liveDividend} ·{' '}
        {new Date(lastLiveAt).toLocaleTimeString(intlLocale)}
      </span>
    </div>
  );
}
