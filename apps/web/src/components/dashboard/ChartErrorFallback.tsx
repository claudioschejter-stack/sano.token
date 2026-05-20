'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';

export function ChartErrorFallback() {
  const t = useTranslation();

  return (
    <div className="flex h-80 flex-col items-center justify-center rounded-lg border border-terminal-warning/30 bg-terminal-warning/5 p-6 text-center">
      <AlertTriangle className="text-terminal-warning" size={28} />
      <p className="mt-3 text-sm font-medium text-terminal-warning">{t.chart.unavailable}</p>
      <p className="mt-1 text-xs text-terminal-muted">{t.chart.unavailableHint}</p>
    </div>
  );
}
