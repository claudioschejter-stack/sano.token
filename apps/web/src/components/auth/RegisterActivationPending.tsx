'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';

const RESEND_COOLDOWN_SECONDS = 60;

type Props = {
  email: string;
  devActivationUrl?: string;
  loginHref?: string;
};

export function RegisterActivationPending({ email, devActivationUrl, loginHref }: Props) {
  const t = useTranslation();
  const a = t.access.activation;
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    if (cooldown > 0) {
      return;
    }

    setResending(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/resend-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!response.ok) {
        setError(a.errors.GENERIC);
        return;
      }
      setResent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError(a.errors.GENERIC);
    } finally {
      setResending(false);
    }
  }

  const resendLabel =
    cooldown > 0
      ? `${a.resendButton} (${cooldown}s)`
      : resending
        ? a.resending
        : a.resendButton;

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Mail size={28} aria-hidden />
      </div>
      <h2 className="text-xl font-bold text-slate-900">{a.pendingTitle}</h2>
      <p className="text-sm text-slate-600">{a.pendingDesc}</p>
      <p className="text-sm font-semibold text-slate-900">{email}</p>
      {devActivationUrl ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs break-all text-amber-900">
          Dev: {devActivationUrl}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {resent ? (
        <p className="text-sm text-emerald-700">{a.resentOk}</p>
      ) : null}
      <button
        type="button"
        disabled={resending || cooldown > 0}
        onClick={() => void resend()}
        className="text-sm font-semibold text-blue-600 hover:text-blue-500 disabled:opacity-60"
      >
        {resendLabel}
      </button>
      <p className="pt-2">
        <Link href={loginHref ?? '/acceso'} className="text-sm font-medium text-blue-600 hover:text-blue-500">
          {a.backToAccess}
        </Link>
      </p>
    </div>
  );
}
