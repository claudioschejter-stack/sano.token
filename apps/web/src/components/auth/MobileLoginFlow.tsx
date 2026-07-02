'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { waitForAccessToken } from '../../lib/auth/waitForAccessToken';
import { getDevicePasskeyHint } from '../../lib/auth/devicePasskeyStorage';
import { useTurnstile } from '../../lib/security/useTurnstile';
import { PasswordInput } from './PasswordInput';
import { PasskeyLoginButton } from './PasskeyLoginButton';

type MobileLoginFlowProps = {
  callbackUrl?: string;
  className?: string;
  initialEmail?: string;
  registerHref?: string;
};

export function MobileLoginFlow({
  callbackUrl = '/acceso/callback',
  className = '',
  initialEmail = '',
  registerHref = '/acceso/registro'
}: MobileLoginFlowProps) {
  const t = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [hasPasskeyHint, setHasPasskeyHint] = useState(false);
  const turnstile = useTurnstile();

  useEffect(() => {
    const hint = getDevicePasskeyHint();
    if (hint?.email) {
      setEmail(hint.email);
      setHasPasskeyHint(true);
    } else if (initialEmail.trim()) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    if (turnstile.enabled && !turnstile.token) {
      setLoading(false);
      setError(t.access.captchaRequired ?? 'Completá la verificación de seguridad.');
      return;
    }

    const step1Res = await fetch('/api/auth/login/step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, turnstileToken: turnstile.token })
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
      turnstile.reset();
      if (step1Data.error === 'CUENTA_BLOQUEADA') {
        setError(t.access.accountLocked ?? 'Cuenta bloqueada temporalmente. Intentá más tarde.');
        return;
      }
      setError(t.access.invalidCredentials);
      return;
    }

    if (step1Data.requiresTOTP && step1Data.tempToken) {
      const params = new URLSearchParams({ t: step1Data.tempToken, callbackUrl });
      router.push(`/acceso/verificar-2fa?${params.toString()}`);
      return;
    }

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

  if (hasPasskeyHint && !showPasswordLogin) {
    return (
      <div className={`space-y-4 ${className}`}>
        <PasskeyLoginButton email={email} callbackUrl={callbackUrl} className="mb-1" />
        <button
          type="button"
          onClick={() => setShowPasswordLogin(true)}
          className="flex min-h-12 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
        >
          {t.access.signInWithPassword ?? 'Ingresar con email y contraseña'}
        </button>
        <div className="flex items-center justify-center">
          <Link
            href={registerHref}
            className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
          >
            {t.access.notRegisteredYet}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePasswordLogin} className={`space-y-4 ${className}`}>
      {hasPasskeyHint ? (
        <PasskeyLoginButton email={email} callbackUrl={callbackUrl} className="mb-1" />
      ) : null}

      <div>
        <label htmlFor="access-email-mobile" className="mb-1.5 block text-sm font-medium text-slate-700">
          {t.access.emailLabel}
        </label>
        <input
          id="access-email-mobile"
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
        id="access-password-mobile"
        label={t.access.passwordLabel}
        placeholder={t.access.passwordPlaceholder}
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {turnstile.widget}

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
    </form>
  );
}
