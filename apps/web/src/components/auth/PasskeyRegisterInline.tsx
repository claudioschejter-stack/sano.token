'use client';

import { Fingerprint, ScanFace } from 'lucide-react';
import { useMemo, useState } from 'react';
import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { saveDevicePasskeyHint } from '../../lib/auth/devicePasskeyStorage';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';

type Props = {
  variant?: 'card' | 'onboarding';
  onRegistered?: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
  className?: string;
};

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PasskeyRegisterInline({
  variant = 'card',
  onRegistered,
  onSkip,
  showSkip = false,
  className = ''
}: Props) {
  const t = useTranslation();
  const p = t.passkey;
  const { data: session } = useSession();
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

      const userEmail = session?.user?.email?.trim().toLowerCase();
      if (userEmail && attestation.id) {
        saveDevicePasskeyHint({ email: userEmail, credentialId: attestation.id });
      }

      setDone(true);
      onRegistered?.();
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
      <p className={`rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ${className}`}>
        {p.registerSuccess}
      </p>
    );
  }

  const isOnboarding = variant === 'onboarding';

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isOnboarding ? 'border-slate-200 bg-white shadow-sm' : 'border-blue-100 bg-blue-50/80'
      } ${className}`}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: MP_ACCENT }}
        >
          <Icon size={28} aria-hidden />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            {isIos ? p.registerFaceTitle : p.registerTitle}
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            {isOnboarding
              ? 'Activá huella o Face ID para ingresar más rápido la próxima vez, como en Mercado Pago.'
              : p.registerDesc}
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleRegister()}
          className="flex min-h-14 w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: MP_ACCENT }}
        >
          {loading ? p.registering : p.registerCta}
        </button>
        {showSkip && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-medium text-slate-500 underline-offset-2 hover:underline"
          >
            Configurar después
          </button>
        ) : null}
        {error ? <p className="text-xs text-amber-700">{error}</p> : null}
      </div>
    </div>
  );
}
