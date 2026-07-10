'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { useIsPwa } from '../../hooks/useIsPwa';
import { usePwaInstallPrompt } from '../../lib/pwa/usePwaInstallPrompt';

type Props = {
  /** The "Enter platform" button (or similar) to reveal once the user is done with this step. */
  children: ReactNode;
};

/**
 * Single, clear install step shown at the end of the registration wizard (screen "done"),
 * replacing the old dismissible banner that used to compete with the biometric CTA on the
 * login screen. Desktop and already-installed PWA sessions skip straight to `children`.
 */
export function InstallAppOnboardingStep({ children }: Props) {
  const t = useTranslation();
  const p = t.pwa;
  const { isMobile } = useDeviceDetection();
  const isPwa = useIsPwa();
  const { canPromptInstall, isIos, promptInstall } = usePwaInstallPrompt();
  const [revealed, setRevealed] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  const showStep = isMobile && !isPwa && !revealed;

  if (!showStep) {
    return <>{children}</>;
  }

  async function handleInstallClick() {
    if (canPromptInstall) {
      await promptInstall();
      setRevealed(true);
      return;
    }
    if (isIos) {
      setShowIosInstructions(true);
      return;
    }
    // No native prompt available (unsupported browser) — don't block the user.
    setRevealed(true);
  }

  return (
    <div className="w-full space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Download size={24} aria-hidden />
        </div>
        <h3 className="mt-3 text-lg font-bold text-slate-900">{p.onboardingTitle}</h3>
        <p className="mt-1 text-sm text-slate-600">{p.onboardingDesc}</p>

        {showIosInstructions ? (
          <>
            <p className="mt-3 rounded-md bg-blue-50 p-3 text-xs font-medium text-blue-800">{p.iosInstruction}</p>
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              {p.onboardingIosContinue}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void handleInstallClick()}
            className="mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-4 text-base font-semibold text-white hover:bg-blue-500"
          >
            {p.onboardingInstallCta}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="block w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        {p.onboardingContinueWithoutInstalling}
      </button>
    </div>
  );
}
