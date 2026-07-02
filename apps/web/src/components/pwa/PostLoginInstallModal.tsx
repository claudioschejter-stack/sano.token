'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { useIsPwa } from '../../hooks/useIsPwa';
import { PWA_POSTLOGIN_SEEN_KEY, usePwaPreferences } from '../../hooks/usePwaPreferences';

export function PostLoginInstallModal() {
  const t = useTranslation();
  const p = t.pwa;
  const { isDesktop } = useDeviceDetection();
  const isPwa = useIsPwa();
  const { dismissed, installed, loaded } = usePwaPreferences();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loaded || !isDesktop || isPwa || dismissed || installed) {
      return;
    }

    if (window.localStorage.getItem(PWA_POSTLOGIN_SEEN_KEY) === '1') {
      return;
    }

    setOpen(true);
  }, [dismissed, installed, isDesktop, isPwa, loaded]);

  function close() {
    window.localStorage.setItem(PWA_POSTLOGIN_SEEN_KEY, '1');
    setOpen(false);
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Smartphone size={24} />
          </div>
          <button type="button" onClick={close} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">{p.installDesktopTitle ?? p.installTitle}</h2>
        <p className="mt-2 text-sm text-slate-600">{p.installDesktopDesc ?? p.installDesc}</p>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
          {p.installDesktopQrHint ?? 'Escaneá el QR del manifest desde tu celular para instalar Sanova.'}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={close}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            <Download size={16} />
            {p.installCta}
          </button>
        </div>
      </div>
    </div>
  );
}
