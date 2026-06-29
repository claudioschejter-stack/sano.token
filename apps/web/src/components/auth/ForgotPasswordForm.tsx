'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';

export function ForgotPasswordForm() {
  const t = useTranslation();
  const p = t.access.passwordReset;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setDevResetUrl(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = (await response.json()) as { error?: string; devResetUrl?: string };

      if (!response.ok) {
        setError(p.errors[data.error as keyof typeof p.errors] ?? p.errors.GENERIC);
        return;
      }

      setSent(true);
      if (data.devResetUrl) {
        setDevResetUrl(data.devResetUrl);
      }
    } catch {
      setError(p.errors.GENERIC);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
          <p className="text-sm font-semibold text-emerald-900">{p.sentTitle}</p>
          <p className="mt-2 text-sm text-emerald-800">{p.sentDesc}</p>
        </div>

        {devResetUrl ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p className="font-semibold">{p.devLinkTitle}</p>
            <a href={devResetUrl} className="mt-2 block break-all font-medium text-blue-700 underline">
              {devResetUrl}
            </a>
          </div>
        ) : null}

        <Link
          href="/acceso"
          className="flex min-h-12 items-center justify-center rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400"
        >
          {p.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-600">{p.forgotDesc}</p>

      <div>
        <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-slate-700">
          {t.access.emailLabel}
        </label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-12 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder={t.access.emailPlaceholder}
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? p.sending : p.sendButton}
      </button>

      <p className="text-center">
        <Link href="/acceso" className="text-sm font-medium text-blue-600 hover:text-blue-500">
          {p.backToLogin}
        </Link>
      </p>
    </form>
  );
}
