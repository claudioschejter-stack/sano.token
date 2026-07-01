'use client';

import { Fingerprint, ScanFace, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { saveDevicePasskeyHint } from '../../lib/auth/devicePasskeyStorage';
import { useIsPwa } from '../../hooks/useIsPwa';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';

const DISMISS_KEY = 'sanova.passkey.prompt.dismissed';

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PasskeyRegisterModal() {
  const t = useTranslation();
  const p = t.passkey;
  const { data: session, status } = useSession();
  const isPwa = useIsPwa();
  const { isMobile } = useDeviceDetection();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPasskeys, setHasPasskeys] = useState<boolean | null>(null);
  const isIos = useMemo(() => isIosDevice(), []);
  const Icon = isIos ? ScanFace : Fingerprint;

  useEffect(() => {
    if (status !== 'authenticated' || (!isPwa && !isMobile)) {
      return;
    }

    if (typeof window !== 'undefined' && window.localStorage.getItem(DISMISS_KEY) === '1') {
      return;
    }

    fetch('/api/auth/passkey/status')
      .then((res) => res.json() as Promise<{ hasPasskeys: boolean }>)
      .then(({ hasPasskeys: hp }) => {
        setHasPasskeys(hp);
        if (!hp) {
          setVisible(true);
        }
      })
      .catch(() => setHasPasskeys(false));
  }, [isMobile, isPwa, status]);

  async function handleRegister() {
    setError(null);
    setLoading(true);

    try {
      if (!window.PublicKeyCredential) {
        throw new Error('NOT_SUPPORTED');
      }

      const optionsResponse = await fetch('/api/auth/passkey/register/options', { method: 'POST' });
      const optionsData = (await optionsResponse.json()) as {
        options?: PublicKeyCredentialCreationOptionsJSON;
        error?: string;
      };

      if (!optionsResponse.ok || !optionsData.options) {
        throw new Error(optionsData.error ?? 'OPTIONS_FAILED');
      }

      const attestation = await startRegistration({ optionsJSON: optionsData.options });

      const verifyResponse = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: attestation,
          deviceName: isIos ? 'Face ID' : 'Huella / biometría'
        })
      });

      if (!verifyResponse.ok) {
        throw new Error('REGISTER_FAILED');
      }

      const userEmail = session?.user?.email?.trim().toLowerCase();
      if (userEmail && attestation.id) {
        saveDevicePasskeyHint({ email: userEmail, credentialId: attestation.id });
      }

      setVisible(false);
      setHasPasskeys(true);
    } catch {
      setError(p.registerFailed);
    } finally {
      setLoading(false);
    }
  }

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  if (!visible || hasPasskeys) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Icon size={24} />
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">{p.registerTitle}</h2>
        <p className="mt-2 text-sm text-slate-600">{p.registerDesc}</p>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleRegister()}
            className="flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? p.registering : p.registerCta}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            {p.registerLater ?? 'Ahora no'}
          </button>
        </div>
      </div>
    </div>
  );
}
