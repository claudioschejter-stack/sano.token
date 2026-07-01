'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { useIsPwa } from '../../hooks/useIsPwa';

const MODAL_SEEN_KEY = 'sanova.pwa.postlogin.seen';

export function PostLoginInstallModal() {
  const t = useTranslation();
  const p = t.pwa;
  const { isDesktop } = useDeviceDetection();
  const isPwa = useIsPwa();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isDesktop || isPwa) {
      return;
    }

    if (window.localStorage.getItem(MODAL_SEEN_KEY) === '1') {
      return;
    }

    if (window.localStorage.getItem('sanova.pwa.installed') === '1') {
      return;
    }

    setOpen(true);
  }, [isDesktop, isPwa]);

  function close() {
    window.localStorage.setItem(MODAL_SEEN_KEY, '1');
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
        <p className="mt-3 text-xs text-slate-500">
          {p.installDesktopHint ?? 'Escaneá el código o abrí sanovacapital.com en tu celular y agregá la app a la pantalla de inicio.'}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <a
            href="/manifest.json"
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
          >
            <Download size={16} />
            {p.installCta}
          </a>
          <button type="button" onClick={close} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            {p.installLater ?? 'Continuar en el navegador'}
          </button>
        </div>
      </div>
    </div>
  );
}
