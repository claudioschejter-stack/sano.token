'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { PasswordInput } from './PasswordInput';

function ResetPasswordFormContent() {
  const t = useTranslation();
  const p = t.access.passwordReset;
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError(p.errors.INVALID_OR_EXPIRED_TOKEN);
      return;
    }

    if (password !== confirmPassword) {
      setError(p.errors.MISMATCH_PASSWORD);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(p.errors[data.error as keyof typeof p.errors] ?? p.errors.GENERIC);
        return;
      }

      setDone(true);
      window.setTimeout(() => {
        router.replace('/acceso');
      }, 2500);
    } catch {
      setError(p.errors.GENERIC);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {p.errors.INVALID_OR_EXPIRED_TOKEN}
        </p>
        <Link
          href="/acceso/olvidar"
          className="flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
        >
          {p.requestNewLink}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
        <p className="text-sm font-semibold text-emerald-900">{p.successTitle}</p>
        <p className="mt-2 text-sm text-emerald-800">{p.successDesc}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-600">{p.resetDesc}</p>

      <PasswordInput
        id="reset-password"
        label={p.newPasswordLabel}
        placeholder={t.access.passwordPlaceholder}
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
      />

      <PasswordInput
        id="reset-password-confirm"
        label={p.confirmPasswordLabel}
        placeholder={t.access.passwordPlaceholder}
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
      />

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? p.submitting : p.submitButton}
      </button>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslation();

  return (
    <Suspense fallback={<p className="text-sm text-slate-600">{t.access.continueButton}…</p>}>
      <ResetPasswordFormContent />
    </Suspense>
  );
}
