'use client';

import Link from 'next/link';
import { Fingerprint, ScanFace } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { waitForAccessToken } from '../../lib/auth/waitForAccessToken';
import { getDevicePasskeyHint } from '../../lib/auth/devicePasskeyStorage';
import { useTurnstile } from '../../lib/security/useTurnstile';
import { formFieldClassName } from '../../lib/ui/formFieldClassName';
import { MP_ACCENT } from '../../lib/pwa/mpTheme';
import { PasswordInput } from './PasswordInput';
import { PasskeyLoginButton } from './PasskeyLoginButton';
import { PasskeyRegisterInline } from './PasskeyRegisterInline';

type MobileLoginFlowProps = {
  callbackUrl?: string;
  className?: string;
  initialEmail?: string;
  registerHref?: string;
};

type MobileLoginView = 'primary' | 'password' | 'enableBiometric';

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function MobileLoginFlow({
  callbackUrl = '/acceso/callback',
  className = '',
  initialEmail = '',
  registerHref = '/acceso/registro'
}: MobileLoginFlowProps) {
  const t = useTranslation();
  const p = t.passkey;
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<MobileLoginView>('primary');
  const [setupBiometricAfterLogin, setSetupBiometricAfterLogin] = useState(false);
  const turnstile = useTurnstile();
  const passkeyHint = useMemo(() => getDevicePasskeyHint(), []);
  const hasConfiguredPasskey = Boolean(passkeyHint?.credentialId);
  const isIos = useMemo(() => isIosDevice(), []);
  const BiometricIcon = isIos ? ScanFace : Fingerprint;

  useEffect(() => {
    const hint = getDevicePasskeyHint();
    if (hint?.email) {
      setEmail(hint.email);
    } else if (initialEmail.trim()) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  async function completePasswordLogin(options?: { setupBiometric?: boolean }) {
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
      const params = new URLSearchParams({
        t: step1Data.tempToken,
        callbackUrl: options?.setupBiometric ? `${callbackUrl}${callbackUrl.includes('?') ? '&' : '?'}setupBiometric=1` : callbackUrl
      });
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

    if (options?.setupBiometric) {
      setSetupBiometricAfterLogin(true);
      setView('enableBiometric');
      return;
    }

    router.refresh();
    router.push(callbackUrl);
  }

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await completePasswordLogin({ setupBiometric: setupBiometricAfterLogin });
  }

  if (view === 'enableBiometric') {
    return (
      <div className={`space-y-4 ${className}`}>
        <PasskeyRegisterInline
          variant="onboarding"
          onRegistered={() => {
            router.refresh();
            router.push(callbackUrl);
          }}
        />
        <button
          type="button"
          onClick={() => {
            router.refresh();
            router.push(callbackUrl);
          }}
          className="flex min-h-12 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
        >
          Continuar sin biometría
        </button>
      </div>
    );
  }

  if (view === 'password') {
    return (
      <form onSubmit={handlePasswordLogin} className={`space-y-4 ${className}`}>
        <button
          type="button"
          onClick={() => {
            setView('primary');
            setSetupBiometricAfterLogin(false);
            setError(null);
          }}
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          ← Volver
        </button>

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
            className={formFieldClassName}
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

        <div className="flex items-center justify-end gap-4">
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

  if (hasConfiguredPasskey) {
    return (
      <div className={`space-y-4 ${className}`}>
        <PasskeyLoginButton
          email={email}
          callbackUrl={callbackUrl}
          autoTrigger
          hideWhenConfigured
        />
        <button
          type="button"
          onClick={() => setView('password')}
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
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: MP_ACCENT }}
          >
            <BiometricIcon size={28} aria-hidden />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {isIos ? 'Habilitar ingreso por Face ID' : 'Habilitar ingreso por biometría'}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Ingresá con tu correo y contraseña una vez para activar huella o Face ID en este dispositivo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSetupBiometricAfterLogin(true);
              setView('password');
            }}
            className="flex min-h-14 w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: MP_ACCENT }}
          >
            {isIos ? p.registerFaceTitle : 'Habilitar ingreso por biometría'}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setSetupBiometricAfterLogin(false);
          setView('password');
        }}
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
