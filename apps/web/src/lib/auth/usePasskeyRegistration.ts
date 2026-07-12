'use client';

import { useState } from 'react';
import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { useSession } from 'next-auth/react';
import { saveDevicePasskeyHint } from './devicePasskeyStorage';

export type PasskeyRegistrationErrorCode =
  | 'NOT_SUPPORTED'
  | 'NO_AUTHENTICATOR'
  | 'CANCELLED'
  | 'CHALLENGE_EXPIRED'
  | 'FAILED';

type RegisterOptions = {
  deviceName: string;
};

/**
 * Some Android phones expose the WebAuthn API but have no fingerprint/Face
 * unlock enrolled — `startRegistration` would still fail there, but with a
 * generic `NotAllowedError` that's indistinguishable from a user cancelling.
 *
 * This is only used as a *hint* to pick a better error message once the
 * actual WebAuthn call has failed — it must never block the attempt up
 * front. Some iOS/WebKit versions report `false` here even when Face ID /
 * Touch ID is enrolled (a known platform quirk), which previously stopped
 * registration before the native biometric prompt ever appeared.
 */
async function hasNoPlatformAuthenticator(): Promise<boolean> {
  const check = window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
  if (typeof check !== 'function') {
    return false;
  }

  try {
    return (await check()) === false;
  } catch {
    return false;
  }
}

export function usePasskeyRegistration() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errorCode, setErrorCode] = useState<PasskeyRegistrationErrorCode | null>(null);

  async function register(options: RegisterOptions): Promise<boolean> {
    setErrorCode(null);
    setLoading(true);

    try {
      if (!window.PublicKeyCredential) {
        throw new Error('NOT_SUPPORTED');
      }

      const optionsResponse = await fetch('/api/auth/passkey/register/options', {
        method: 'POST',
        credentials: 'same-origin'
      });
      const optionsData = (await optionsResponse.json()) as {
        options?: PublicKeyCredentialCreationOptionsJSON;
        error?: string;
      };

      if (!optionsResponse.ok || !optionsData.options) {
        throw new Error(optionsData.error ?? 'FAILED');
      }

      const attestation = await startRegistration({ optionsJSON: optionsData.options });

      const verifyResponse = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: attestation,
          deviceName: options.deviceName
        })
      });

      if (!verifyResponse.ok) {
        const verifyData = (await verifyResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(verifyData?.error ?? 'FAILED');
      }

      const userEmail = session?.user?.email?.trim().toLowerCase();
      if (userEmail && attestation.id) {
        saveDevicePasskeyHint({ email: userEmail, credentialId: attestation.id });
      }

      setDone(true);
      return true;
    } catch (caught) {
      // Native WebAuthn failures surface as a DOMException whose `.name` holds
      // the spec error (e.g. "NotAllowedError") — `.message` is only a human
      // sentence and never matches a code, so it must be checked first here.
      // Our own thrown Errors (NOT_SUPPORTED, server codes like
      // CHALLENGE_EXPIRED) use `.message` as the code instead.
      const name =
        caught instanceof DOMException
          ? caught.name
          : caught instanceof Error
            ? caught.message
            : 'FAILED';

      let code: PasskeyRegistrationErrorCode =
        name === 'NOT_SUPPORTED'
          ? 'NOT_SUPPORTED'
          : name === 'CHALLENGE_EXPIRED'
            ? 'CHALLENGE_EXPIRED'
            : name === 'NotAllowedError' || name === 'AbortError'
              ? 'CANCELLED'
              : 'FAILED';

      // The browser rejected the request without the biometric prompt ever
      // appearing (NotAllowedError with no user interaction) — only then do
      // we use the platform-authenticator hint to give a more actionable
      // message instead of a generic "cancelled".
      if (code === 'CANCELLED' && (await hasNoPlatformAuthenticator())) {
        code = 'NO_AUTHENTICATOR';
      }

      setErrorCode(code);
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { register, loading, done, errorCode, setErrorCode };
}
