'use client';

import { useState } from 'react';
import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { useSession } from 'next-auth/react';
import { saveDevicePasskeyHint } from './devicePasskeyStorage';

export type PasskeyRegistrationErrorCode = 'NOT_SUPPORTED' | 'CANCELLED' | 'FAILED';

type RegisterOptions = {
  deviceName: string;
};

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

      const optionsResponse = await fetch('/api/auth/passkey/register/options', { method: 'POST' });
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: attestation,
          deviceName: options.deviceName
        })
      });

      if (!verifyResponse.ok) {
        throw new Error('FAILED');
      }

      const userEmail = session?.user?.email?.trim().toLowerCase();
      if (userEmail && attestation.id) {
        saveDevicePasskeyHint({ email: userEmail, credentialId: attestation.id });
      }

      setDone(true);
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'FAILED';
      const code: PasskeyRegistrationErrorCode =
        message === 'NOT_SUPPORTED'
          ? 'NOT_SUPPORTED'
          : message === 'NotAllowedError' || message === 'AbortError'
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
