'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useMobilePortal } from '../../hooks/useMobilePortal';
import { MOBILE_INVESTOR_HOME_PATH } from '../../lib/auth/mobileDestinations';

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function RegistrationSuccessModal({ visible, onDismiss }: Props) {
  const t = useTranslation();
  const s = t.access.registrationSuccess;
  const isMobilePortal = useMobilePortal();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  async function handleContinue() {
    setBusy(true);
    try {
      await fetch('/api/onboarding/ack-success', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // Still dismiss — ack is best-effort.
    }
    onDismiss();
    if (isMobilePortal) {
      window.location.assign(MOBILE_INVESTOR_HOME_PATH);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-xl">
        <CheckCircle2 className="mx-auto text-emerald-500" size={56} aria-hidden />
        <h2 className="mt-4 text-2xl font-bold text-slate-900">{s.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleContinue()}
          className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 text-base font-semibold text-white disabled:opacity-60"
        >
          {busy ? s.continuing : s.continueButton}
        </button>
      </div>
    </div>
  );
}
