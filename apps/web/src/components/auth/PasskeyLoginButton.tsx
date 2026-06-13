'use client';

import { Fingerprint, ScanFace } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
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
  className = ''
}: PasskeyLoginButtonProps) {
  const t = useTranslation();
  const p = t.passkey;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isIos = useMemo(() => isIosDevice(), []);
  const Icon = isIos ? ScanFace : Fingerprint;

  async function handlePasskeyLogin() {
    setError(null);
    setLoading(true);

    try {
      if (!window.PublicKeyCredential) {
        throw new Error('NOT_SUPPORTED');
      }

      const deviceHint = getDevicePasskeyHint();
      const loginEmail = email.trim() || deviceHint?.email || null;

      const optionsResponse = await fetch('/api/auth/passkey/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          deviceCredentialId: deviceHint?.credentialId ?? null
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
        email?: string;
        error?: string;
      };
      if (!verifyResponse.ok || !verifyData.loginToken) {
        const code = verifyData.error ?? 'VERIFY_FAILED';
        if (code === 'PASSKEY_NOT_FOUND') {
          clearDevicePasskeyHint();
        }
        throw new Error(code);
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
                : p.loginFailed
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={loading}
        onClick={() => void handlePasskeyLogin()}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon size={18} aria-hidden />
        {loading ? p.signingIn : isIos ? p.loginFaceId : p.loginBiometric}
      </button>
      {error ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
