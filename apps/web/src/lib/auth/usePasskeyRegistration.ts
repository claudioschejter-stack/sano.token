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
 * Checking this up front lets us show a much more actionable message.
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

      if (await hasNoPlatformAuthenticator()) {
        throw new Error('NO_AUTHENTICATOR');
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
      // Our own thrown Errors (NOT_SUPPORTED, NO_AUTHENTICATOR, server codes
      // like CHALLENGE_EXPIRED) use `.message` as the code instead.
      const name =
        caught instanceof DOMException
          ? caught.name
          : caught instanceof Error
            ? caught.message
            : 'FAILED';

      const code: PasskeyRegistrationErrorCode =
        name === 'NOT_SUPPORTED'
          ? 'NOT_SUPPORTED'
          : name === 'NO_AUTHENTICATOR'
            ? 'NO_AUTHENTICATOR'
            : name === 'CHALLENGE_EXPIRED'
              ? 'CHALLENGE_EXPIRED'
              : name === 'NotAllowedError' || name === 'AbortError'
                ? 'CANCELLED'
                : 'FAILED';
      setErrorCode(code);
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { register, loading, done, errorCode, setErrorCode };
}
