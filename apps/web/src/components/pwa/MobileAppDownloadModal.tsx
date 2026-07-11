'use client';

import { Download, Smartphone, X } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { usePwaInstallPrompt } from '../../lib/pwa/usePwaInstallPrompt';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type MobileAppDownloadModalProps = {
  open: boolean;
  onClose: () => void;
  onContinueWeb: () => void;
  onInstallAccepted: () => void;
};

export function MobileAppDownloadModal({
  open,
  onClose,
  onContinueWeb,
  onInstallAccepted
}: MobileAppDownloadModalProps) {
  const t = useTranslation();
  const m = t.mobileAppPrompt;
  const p = t.pwa;
  const { canPromptInstall, isIos, promptInstall } = usePwaInstallPrompt();

  if (!open) {
    return null;
  }

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      // Genuinely confirmed by the native browser prompt — safe to persist
      // "installed" permanently.
      onInstallAccepted();
      return;
    }

    if (outcome === 'unavailable' && isIos) {
      // iOS Safari has no native install prompt — we only show manual "Add
      // to Home Screen" instructions above and can't confirm the user
      // actually completed them, so this must NOT permanently mark the
      // device as installed (that would suppress this gate forever even if
      // they never finish the manual steps). Just stop nagging for the rest
      // of this browser session, same as "continuar en la web".
      onContinueWeb();
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-app-prompt-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: MP_ACCENT }}
          >
            <Smartphone size={24} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label={p.dismiss}
          >
            <X size={20} />
          </button>
        </div>

        <h2 id="mobile-app-prompt-title" className="mt-4 text-lg font-bold text-slate-900">
          {m.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{m.description}</p>

        {isIos ? (
          <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs font-medium text-blue-800">{p.iosInstruction}</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: MP_ACCENT }}
          >
            <Download size={16} />
            {canPromptInstall || isIos ? m.downloadYes : p.installCta}
          </button>
          <button
            type="button"
            onClick={onContinueWeb}
            className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {m.downloadNo}
          </button>
        </div>
      </div>
    </div>
  );
}
