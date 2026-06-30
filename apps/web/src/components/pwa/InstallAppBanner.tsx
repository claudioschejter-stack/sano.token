'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallAppBanner() {
  const t = useTranslation();
  const p = t.pwa;
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsStandalone(standalone);

    // Detect iOS Safari
    const ua = window.navigator.userAgent;
    const isIosDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
    
    if (isIosDevice && isSafari) {
      setIsIos(true);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isStandalone || dismissed || (!deferredPrompt && !isIos)) {
    return null;
  }

  return (
    <div className="border-b border-blue-100 bg-blue-50 px-4 py-3 safe-top">
      <div className="mx-auto flex max-w-md items-start gap-3">
        <Download className="mt-0.5 shrink-0 text-blue-600" size={18} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{p.installTitle}</p>
          <p className="mt-0.5 text-xs text-slate-600">{p.installDesc}</p>
          
          {isIos ? (
            <p className="mt-2 text-xs font-medium text-blue-800 bg-blue-100/50 p-2 rounded-md">
              {p.iosInstruction}
            </p>
          ) : (
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-blue-600"
              onClick={() => {
                if (deferredPrompt) {
                  void deferredPrompt.prompt();
                  setDeferredPrompt(null);
                }
              }}
            >
              {p.installCta}
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label={p.dismiss}
          className="shrink-0 text-slate-400"
          onClick={() => setDismissed(true)}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
