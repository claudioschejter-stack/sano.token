'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { waitForAccessToken } from '../../lib/auth/waitForAccessToken';
import { getDevicePasskeyHint } from '../../lib/auth/devicePasskeyStorage';
import { PasswordInput } from './PasswordInput';
import { PasskeyLoginButton } from './PasskeyLoginButton';
import { OAuthSignInButtons } from './OAuthSignInButtons';

type LoginFormProps = {
  callbackUrl?: string;
  className?: string;
  initialEmail?: string;
  registerHref?: string;
};

export function LoginForm({
  callbackUrl = '/acceso/callback',
  className = '',
  initialEmail = '',
  registerHref = '/acceso/registro'
}: LoginFormProps) {
  const t = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialEmail.trim()) {
      return;
    }

    const hint = getDevicePasskeyHint();
    if (hint?.email) {
      setEmail(hint.email);
    }
  }, [initialEmail]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    // Paso 1: verificar credenciales — detectar si requiere 2FA
    const step1Res = await fetch('/api/auth/login/step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password })
    });

    const step1Data = (await step1Res.json()) as {
      ok?: boolean;
      requiresTOTP?: boolean;
      tempToken?: string;
      error?: string;
      remainingSeconds?: number;
    };

    if (!step1Res.ok || !step1Data.ok) {
      setLoading(false);
      setError(t.access.invalidCredentials);
      return;
    }

    // Si requiere 2FA → redirigir a pantalla de verificación TOTP
    if (step1Data.requiresTOTP && step1Data.tempToken) {
      const params = new URLSearchParams({ t: step1Data.tempToken, callbackUrl });
      router.push(`/acceso/verificar-2fa?${params.toString()}`);
      return;
    }

    // Sin 2FA → login normal con NextAuth
    const result = await signIn('credentials', {
      email: email.trim(),
      password,
      redirect: false
    });

    if (result?.error) {
      setLoading(false);
      setError(t.access.invalidCredentials);
      return;
    }

    const sessionReady = await waitForAccessToken();
    setLoading(false);

    if (!sessionReady) {
      setError(t.access.authError);
      return;
    }

    router.refresh();
    router.push(callbackUrl);
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <OAuthSignInButtons callbackUrl={callbackUrl} />

      <div>
        <label htmlFor="access-email" className="mb-1.5 block text-sm font-medium text-slate-700">
          {t.access.emailLabel}
        </label>
        <input
          id="access-email"
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

      <PasswordInput
        id="access-password"
        label={t.access.passwordLabel}
        placeholder={t.access.passwordPlaceholder}
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <PasskeyLoginButton email={email} callbackUrl={callbackUrl} className="mb-1" />

      <p className="text-center text-xs text-slate-400">{t.passkey.orDivider}</p>

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-12 w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? t.access.signingIn : t.access.signInButton}
      </button>

      <div className="flex items-center justify-between gap-4">
        <Link
          href={registerHref}
          className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
        >
          {t.access.notRegisteredYet}
        </Link>
        <Link
          href="/acceso/olvidar"
          className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
        >
          {t.access.forgotPassword}
        </Link>
      </div>

      <p className="text-center text-xs leading-relaxed text-slate-500">
        {t.legal.loginNotice}{' '}
        <Link href="/terminos" className="font-medium text-blue-600 hover:text-blue-500">
          {t.legal.termsLink}
        </Link>
        {' · '}
        <Link href="/privacidad" className="font-medium text-blue-600 hover:text-blue-500">
          {t.legal.privacyLink}
        </Link>
      </p>
    </form>
  );
}
