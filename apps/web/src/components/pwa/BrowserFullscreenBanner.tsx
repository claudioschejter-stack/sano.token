'use client';

import { Download, Smartphone } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useIsPwa } from '../../hooks/useIsPwa';
import { usePwaInstallPrompt } from '../../lib/pwa/usePwaInstallPrompt';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

/**
 * Shown only when the portal runs inside a regular browser / Custom Tab.
 * That top Chrome bar (X · title · domain) cannot be removed with CSS — the
 * user must open the installed PWA from the home-screen icon.
 */
export function BrowserFullscreenBanner() {
  const t = useTranslation();
  const m = t.mobileAppPrompt;
  const isPwa = useIsPwa();
  const p = t.pwa;
  const { canPromptInstall, isIos, promptInstall } = usePwaInstallPrompt();

  if (isPwa) {
    return null;
  }

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome === 'unavailable' && isIos) {
      window.alert(p.iosInstruction);
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 text-white"
      style={{ backgroundColor: '#0B2240' }}
      role="status"
    >
      <Smartphone size={18} className="shrink-0 opacity-90" aria-hidden />
      <p className="min-w-0 flex-1 text-xs leading-snug font-medium">{m.browserBarHint}</p>
      <button
        type="button"
        onClick={() => void handleInstall()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
        style={{ backgroundColor: MP_ACCENT }}
      >
        <Download size={14} aria-hidden />
        {canPromptInstall || isIos ? m.downloadYes : p.installCta}
      </button>
    </div>
  );
}
