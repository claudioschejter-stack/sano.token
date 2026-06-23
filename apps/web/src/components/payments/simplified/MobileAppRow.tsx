'use client';

import { ExternalLink } from 'lucide-react';
import type { DetectedApp } from '../../../hooks/useMobileWalletDetection';
import { useTranslation } from '../../../i18n/LocaleProvider';

type Props = {
  app: DetectedApp;
  /** Full deep link to open (may include payment params) */
  actionDeepLink?: string;
};

export function MobileAppRow({ app, actionDeepLink }: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;

  const handleOpen = () => {
    const target = actionDeepLink ?? app.deepLink;
    window.location.href = target;

    // iOS fallback: if app didn't open after 1.5s, show store link
    if (app.installed === 'unknown' && app.storeUrl) {
      const start = Date.now();
      const check = setInterval(() => {
        if (document.hidden) {
          clearInterval(check);
          return;
        }
        if (Date.now() - start > 1500) {
          clearInterval(check);
          window.open(app.storeUrl, '_blank');
        }
      }, 200);
    }
  };

  const showInstalled = app.installed === true;
  const showUnknown = app.installed === 'unknown';

  return (
    <div className="flex items-center justify-between rounded-lg border border-terminal-border bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-terminal-text">{app.name}</span>
        {showInstalled && (
          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
            Instalada
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpen}
          className="flex items-center gap-1 rounded-lg bg-terminal-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
        >
          {showUnknown
            ? sc.openOrInstall
            : showInstalled
              ? sc.fiatWalletOpenApp.replace('{name}', '')
              : sc.downloadApp}
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
