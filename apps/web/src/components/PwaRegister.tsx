'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useTranslation } from '../i18n/LocaleProvider';
import { APP_VERSION } from '../generated/appVersion';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function PwaRegister() {
  const t = useTranslation();
  const p = t.pwa;
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      void registration.update();
    }).catch(() => {
      // Service worker is optional in local dev.
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let cancelled = false;

    async function checkForUpdate() {
      try {
        const res = await fetch('/api/app-version', { cache: 'no-store' });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as { version?: string };
        if (!cancelled && data.version && data.version !== APP_VERSION) {
          setUpdateAvailable(true);
        }
      } catch {
        // Offline or transient network error — try again on the next poll.
      }
    }

    void checkForUpdate();

    const intervalId = window.setInterval(() => void checkForUpdate(), POLL_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void checkForUpdate();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  function reload() {
    window.location.reload();
  }

  if (!updateAvailable || dismissed) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-[90] mx-auto max-w-sm rounded-2xl border border-blue-100 bg-white p-4 shadow-lg sm:right-4 sm:left-auto">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <RefreshCw size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{p.updateAvailableTitle}</p>
          <p className="mt-0.5 text-xs text-slate-600">{p.updateAvailableDesc}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
          >
            <RefreshCw size={12} />
            {p.updateReloadCta}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-slate-600"
          aria-label={p.dismiss}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
