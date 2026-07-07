'use client';

import { Suspense, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '../../../../i18n/LocaleProvider';
import { waitForAccessToken } from '../../../../lib/auth/waitForAccessToken';
import { buildKycUrl } from '../../../../lib/auth/kycPaths';
import { safeReturnTo } from '../../../../lib/auth/redirects';

function KycMovilContent() {
  const t = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resume = searchParams.get('resume')?.trim() ?? '';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resume) {
      setError(t.access.continueOnMobile.errors.INVALID_OR_EXPIRED_TOKEN);
      return;
    }

    let cancelled = false;

    async function resumeOnMobile() {
      try {
        const response = await fetch('/api/onboarding/resume-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume })
        });
        const data = (await response.json()) as {
          loginToken?: string;
          returnTo?: string;
          error?: string;
        };

        if (!response.ok || !data.loginToken) {
          if (!cancelled) {
            setError(t.access.continueOnMobile.errors.INVALID_OR_EXPIRED_TOKEN);
          }
          return;
        }

        const signInResult = await signIn('activation', {
          loginToken: data.loginToken,
          redirect: false
        });

        if (signInResult?.error) {
          if (!cancelled) {
            setError(t.access.activation.errors.SIGN_IN_FAILED);
          }
          return;
        }

        const sessionReady = await waitForAccessToken();
        if (!sessionReady) {
          if (!cancelled) {
            setError(t.access.activation.errors.SIGN_IN_FAILED);
          }
          return;
        }

        const returnTo = safeReturnTo(data.returnTo, '/dashboard');
        router.replace(buildKycUrl(returnTo, '/dashboard', undefined, { registered: true }));
      } catch {
        if (!cancelled) {
          setError(t.access.continueOnMobile.errors.GENERIC);
        }
      }
    }

    void resumeOnMobile();

    return () => {
      cancelled = true;
    };
  }, [resume, router, t.access.activation.errors.SIGN_IN_FAILED, t.access.continueOnMobile.errors]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-white px-4 text-center">
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        <p className="text-sm text-slate-600">{t.common.loadingGeneric}</p>
      )}
    </div>
  );
}

export default function KycMovilPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <KycMovilContent />
    </Suspense>
  );
}
