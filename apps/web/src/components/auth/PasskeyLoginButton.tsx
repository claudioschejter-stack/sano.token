'use client';

import { Fingerprint, ScanFace } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { useTranslation } from '../../i18n/LocaleProvider';
import { waitForAccessToken } from '../../lib/auth/waitForAccessToken';
import {
  clearDevicePasskeyHint,
  getDevicePasskeyHint,
  saveDevicePasskeyHint
} from '../../lib/auth/devicePasskeyStorage';

type PasskeyLoginButtonProps = {
  email?: string;
  callbackUrl?: string;
  className?: string;
  /** Automatically attempt passkey login when this device has biometrics configured. */
  autoTrigger?: boolean;
  /** Hide the biometric button once passkey is configured on this device. */
  hideWhenConfigured?: boolean;
  /** Visual style for the biometric splash (dark/blue background). */
  variant?: 'default' | 'splash';
};

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PasskeyLoginButton({
  email = '',
  callbackUrl = '/acceso/callback',
  className = '',
  autoTrigger = false,
  hideWhenConfigured = false,
  variant = 'default'
}: PasskeyLoginButtonProps) {
  const t = useTranslation();
  const p = t.passkey;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isIos = useMemo(() => isIosDevice(), []);
  const Icon = isIos ? ScanFace : Fingerprint;
  const deviceHint = useMemo(() => getDevicePasskeyHint(), []);
  const hasConfiguredPasskey = Boolean(deviceHint?.credentialId);
  const autoAttemptedRef = useRef(false);

  const handlePasskeyLogin = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      if (!window.PublicKeyCredential) {
        throw new Error('NOT_SUPPORTED');
      }

      const hint = getDevicePasskeyHint();
      const loginEmail = email.trim() || hint?.email || null;

      const optionsResponse = await fetch('/api/auth/passkey/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          deviceCredentialId: hint?.credentialId ?? null
        })
      });

      const optionsData = (await optionsResponse.json()) as {
        options?: PublicKeyCredentialRequestOptionsJSON;
        error?: string;
      };

      if (!optionsResponse.ok || !optionsData.options) {
        const code = optionsData.error ?? 'OPTIONS_FAILED';
        if (code === 'PASSKEY_NOT_FOUND') {
          clearDevicePasskeyHint();
        }
        throw new Error(code);
      }

      const assertion = await startAuthentication({ optionsJSON: optionsData.options });

      const verifyResponse = await fetch('/api/auth/passkey/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion })
      });

      const verifyData = (await verifyResponse.json()) as {
        loginToken?: string;
        requiresTOTP?: boolean;
        tempToken?: string;
        email?: string;
        error?: string;
        remainingSeconds?: number;
      };
      if (!verifyResponse.ok) {
        const code = verifyData.error ?? 'VERIFY_FAILED';
        if (code === 'PASSKEY_NOT_FOUND') {
          clearDevicePasskeyHint();
        }
        if (code === 'CUENTA_BLOQUEADA') {
          throw new Error(`CUENTA_BLOQUEADA:${verifyData.remainingSeconds ?? 0}`);
        }
        throw new Error(code);
      }

      if (verifyData.requiresTOTP && verifyData.tempToken) {
        const params = new URLSearchParams({ t: verifyData.tempToken, callbackUrl });
        router.push(`/acceso/verificar-2fa?${params.toString()}`);
        return;
      }

      if (!verifyData.loginToken) {
        throw new Error('VERIFY_FAILED');
      }

      const hintEmail = verifyData.email?.trim().toLowerCase() || loginEmail;
      if (hintEmail && assertion.id) {
        saveDevicePasskeyHint({ email: hintEmail, credentialId: assertion.id });
      }

      const result = await signIn('passkey', {
        loginToken: verifyData.loginToken,
        redirect: false
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      const sessionReady = await waitForAccessToken();
      if (!sessionReady) {
        throw new Error('SESSION_FAILED');
      }

      router.refresh();
      router.push(callbackUrl);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : 'PASSKEY_LOGIN_FAILED';
      if (code === 'NotAllowedError' || code === 'AbortError') {
        setError(p.loginCancelled);
      } else {
        setError(
          code === 'NOT_SUPPORTED'
            ? p.notSupported
            : code === 'PASSKEY_NOT_FOUND'
              ? p.notRegistered
              : code === 'CHALLENGE_EXPIRED'
                ? p.challengeExpired
                : code.startsWith('CUENTA_BLOQUEADA')
                  ? (t.access.accountLocked ?? 'Cuenta bloqueada temporalmente. Intentá más tarde.')
                  : p.loginFailed
        );
      }
    } finally {
      setLoading(false);
    }
  }, [callbackUrl, email, p.challengeExpired, p.loginCancelled, p.loginFailed, p.notRegistered, p.notSupported, router, t.access.accountLocked]);

  useEffect(() => {
    if (!autoTrigger || !hasConfiguredPasskey || autoAttemptedRef.current) {
      return;
    }

    autoAttemptedRef.current = true;
    void handlePasskeyLogin();
  }, [autoTrigger, handlePasskeyLogin, hasConfiguredPasskey]);

  const hideButton = hideWhenConfigured && hasConfiguredPasskey;

  if (hideButton && loading) {
    return (
      <div className={className}>
        <p
          className={`py-3 text-center text-sm ${
            variant === 'splash' ? 'text-white/80' : 'text-slate-500'
          }`}
        >
          {p.signingIn}
        </p>
      </div>
    );
  }

  if (hideButton && !error) {
    return null;
  }

  const buttonClassName =
    variant === 'splash'
      ? 'flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/15 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60'
      : 'flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className={className}>
      {!hideButton ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void handlePasskeyLogin()}
          className={buttonClassName}
        >
          <Icon size={18} aria-hidden />
          {loading ? p.signingIn : isIos ? p.loginFaceId : p.loginBiometric}
        </button>
      ) : null}
      {error ? (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-xs ${
            variant === 'splash'
              ? 'border border-white/25 bg-black/25 text-white/90'
              : 'border border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
