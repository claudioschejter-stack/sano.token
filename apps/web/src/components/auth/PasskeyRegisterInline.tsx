'use client';

import { Fingerprint, ScanFace } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { usePasskeyRegistration } from '../../lib/auth/usePasskeyRegistration';
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
  const isIos = useMemo(() => isIosDevice(), []);
  const Icon = isIos ? ScanFace : Fingerprint;
  const { register, loading, done, errorCode } = usePasskeyRegistration();

  const error = errorCode
    ? errorCode === 'NOT_SUPPORTED'
      ? p.notSupported
      : errorCode === 'NO_AUTHENTICATOR'
        ? p.registerNoAuthenticator
        : errorCode === 'CANCELLED'
          ? p.registerCancelled
          : errorCode === 'CHALLENGE_EXPIRED'
            ? p.registerChallengeExpired
            : p.registerFailed
    : null;

  async function handleRegister() {
    const ok = await register({ deviceName: isIos ? p.deviceNameFaceId : p.deviceNameGeneric });
    if (ok) {
      onRegistered?.();
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
            {isOnboarding ? p.registerOnboardingDesc : p.registerDesc}
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
            {p.registerLater}
          </button>
        ) : null}
        {error ? <p className="text-xs text-amber-700">{error}</p> : null}
      </div>
    </div>
  );
}
