'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { waitForAccessToken } from '../../lib/auth/waitForAccessToken';
import { resolveAuthenticatedDestination, safeReturnTo } from '../../lib/auth/redirects';
import { DEFAULT_POST_ONBOARDING_PATH } from '../../lib/auth/kycPaths';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { MobileAuthShell } from '../auth/MobileAuthShell';

export function ActivateAccountClient() {
  const t = useTranslation();
  const a = t.access.activation;
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const { isMobile } = useDeviceDetection();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!token) {
      setBusy(false);
      setError(a.errors.INVALID_OR_EXPIRED_TOKEN);
      return;
    }

    let cancelled = false;

    async function activate() {
      try {
        const response = await fetch('/api/auth/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = (await response.json()) as {
          loginToken?: string;
          registrationChannel?: string | null;
          error?: string;
        };

        if (!response.ok || !data.loginToken) {
          if (!cancelled) {
            setError(a.errors[data.error ?? 'GENERIC'] ?? a.errors.GENERIC);
            setBusy(false);
          }
          return;
        }

        const signInResult = await signIn('activation', {
          loginToken: data.loginToken,
          redirect: false
        });

        if (signInResult?.error) {
          if (!cancelled) {
            setError(a.errors.SIGN_IN_FAILED);
            setBusy(false);
          }
          return;
        }

        const sessionReady = await waitForAccessToken();
        if (!sessionReady) {
          if (!cancelled) {
            setError(a.errors.SIGN_IN_FAILED);
            setBusy(false);
          }
          return;
        }

        const returnTo = safeReturnTo(searchParams.get('returnTo'), DEFAULT_POST_ONBOARDING_PATH);
        const destination = resolveAuthenticatedDestination('INVESTOR', returnTo, false, {
          registered: true,
          isMobile,
          registrationChannel: data.registrationChannel
        });

        router.replace(destination);
      } catch {
        if (!cancelled) {
          setError(a.errors.GENERIC);
          setBusy(false);
        }
      }
    }

    void activate();

    return () => {
      cancelled = true;
    };
  }, [a.errors, isMobile, router, searchParams, token]);

  return (
    <MobileAuthShell title={a.title} subtitle={busy ? a.subtitleActivating : a.subtitleError}>
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Mail size={28} aria-hidden />
        </div>
        {busy ? (
          <p className="text-sm text-slate-600">{a.activating}</p>
        ) : error ? (
          <>
            <p className="text-sm text-red-700">{error}</p>
            <Link href="/acceso" className="text-sm font-semibold text-blue-600 hover:text-blue-500">
              {a.backToAccess}
            </Link>
          </>
        ) : null}
      </div>
    </MobileAuthShell>
  );
}
