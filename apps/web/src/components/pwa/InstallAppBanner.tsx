'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { useIsPwa } from '../../hooks/useIsPwa';
import { usePwaPreferences } from '../../hooks/usePwaPreferences';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallAppBanner() {
  const t = useTranslation();
  const p = t.pwa;
  const { isDesktop } = useDeviceDetection();
  const isPwa = useIsPwa();
  const { dismissed, installed, setDismissed, setInstalled, loaded } = usePwaPreferences();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const ua = window.navigator.userAgent;
    const isIosDevice =
      /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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

  useEffect(() => {
    if (isPwa) {
      setInstalled(true);
    }
  }, [isPwa, setInstalled]);

  function dismissBanner() {
    setDismissed(true);
  }

  function markAlreadyHaveApp() {
    setInstalled(true);
    dismissBanner();
  }

  if (!loaded || isPwa || dismissed) {
    return null;
  }

  // Already installed on this device: swap the CTA to "Abrir la app" instead of hiding
  // the banner, since the button is the primary way to launch the installed PWA.
  if (installed) {
    return (
      <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 shrink-0 text-emerald-600" size={18} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{p.openTitle ?? p.installTitle}</p>
            <p className="mt-0.5 text-xs text-slate-600">{p.openDesc ?? p.installDesc}</p>
            <a
              href="/acceso"
              className="mt-2 inline-block text-sm font-semibold text-emerald-700"
            >
              {p.openCta ?? 'Abrir la app'}
            </a>
          </div>
          <button
            type="button"
            onClick={dismissBanner}
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-emerald-100 hover:text-slate-600"
            aria-label={p.dismiss}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  const canInstallNative = Boolean(deferredPrompt) || isIos;

  if (!canInstallNative && !isDesktop) {
    return null;
  }

  return (
    <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
      <div className="flex items-start gap-3">
        {isDesktop ? <Smartphone className="mt-0.5 shrink-0 text-blue-600" size={18} /> : <Download className="mt-0.5 shrink-0 text-blue-600" size={18} />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {isDesktop ? p.installDesktopTitle ?? p.installTitle : p.installTitle}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {isDesktop ? p.installDesktopDesc ?? p.installDesc : p.installDesc}
          </p>

          {isIos ? (
            <p className="mt-2 rounded-md bg-blue-100/50 p-2 text-xs font-medium text-blue-800">{p.iosInstruction}</p>
          ) : deferredPrompt ? (
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-blue-600"
              onClick={() => {
                void deferredPrompt.prompt().then(() => {
                  setDeferredPrompt(null);
                  setInstalled(true);
                });
              }}
            >
              {p.installCta}
            </button>
          ) : null}

          <button
            type="button"
            onClick={markAlreadyHaveApp}
            className="mt-2 block text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {p.alreadyInstalled ?? 'Ya tengo la app instalada'}
          </button>
        </div>
        <button
          type="button"
          onClick={dismissBanner}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-blue-100 hover:text-slate-600"
          aria-label={p.dismiss}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
