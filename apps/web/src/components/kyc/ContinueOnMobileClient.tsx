'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { safeReturnTo } from '../../lib/auth/redirects';
import { DEFAULT_POST_ONBOARDING_PATH } from '../../lib/auth/kycPaths';
import { useAccountStatus } from '../../hooks/useAccountStatus';

export function ContinueOnMobileClient() {
  const t = useTranslation();
  const c = t.access.continueOnMobile;
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'), DEFAULT_POST_ONBOARDING_PATH);
  const { status } = useSession();
  const { checklist } = useAccountStatus();
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadResumeUrl = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch('/api/onboarding/resume-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnTo })
      });
      const data = (await response.json()) as { resumeUrl?: string; error?: string };
      if (!response.ok || !data.resumeUrl) {
        setError(c.errors.GENERIC);
        return;
      }
      setResumeUrl(data.resumeUrl);
    } catch {
      setError(c.errors.GENERIC);
    }
  }, [c.errors.GENERIC, returnTo]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }
    void loadResumeUrl();
  }, [loadResumeUrl, status]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-white px-4 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
          <Smartphone size={24} aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-bold">{c.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{c.desc}</p>

        {checklist?.contactVerified ? (
          <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {c.phoneDoneHint}
          </p>
        ) : null}

        {resumeUrl ? (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <QRCodeSVG value={resumeUrl} size={220} level="M" includeMargin />
          </div>
        ) : error ? (
          <p className="mt-8 text-sm text-red-700">{error}</p>
        ) : (
          <p className="mt-8 text-sm text-slate-500">{c.loadingQr}</p>
        )}

        <p className="mt-6 text-xs leading-relaxed text-slate-500">{c.footerHint}</p>
      </div>
    </div>
  );
}
