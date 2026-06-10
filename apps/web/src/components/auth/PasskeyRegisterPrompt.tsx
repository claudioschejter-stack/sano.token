'use client';

import { Fingerprint, ScanFace } from 'lucide-react';
import { useMemo, useState } from 'react';
import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { useTranslation } from '../../i18n/LocaleProvider';

type PasskeyRegisterPromptProps = {
  className?: string;
};

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PasskeyRegisterPrompt({ className = '' }: PasskeyRegisterPromptProps) {
  const t = useTranslation();
  const p = t.passkey;
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isIos = useMemo(() => isIosDevice(), []);
  const Icon = isIos ? ScanFace : Fingerprint;

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

      setDone(true);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : 'REGISTER_FAILED';
      setError(
        code === 'NOT_SUPPORTED'
          ? p.notSupported
          : code === 'NotAllowedError' || code === 'AbortError'
            ? p.registerCancelled
            : p.registerFailed
      );
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className={`rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ${className}`}>
        {p.registerSuccess}
      </p>
    );
  }

  return (
    <div className={`rounded-xl border border-blue-100 bg-blue-50/80 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 shrink-0 text-blue-600" size={20} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{isIos ? p.registerFaceTitle : p.registerTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{p.registerDesc}</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleRegister()}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? p.registering : p.registerCta}
          </button>
          {error ? <p className="mt-2 text-xs text-amber-700">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
