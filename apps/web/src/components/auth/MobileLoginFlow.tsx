'use client';

import Link from 'next/link';
import { Fingerprint } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { waitForAccessToken } from '../../lib/auth/waitForAccessToken';
import { getDevicePasskeyHint } from '../../lib/auth/devicePasskeyStorage';
import { useIsPwa } from '../../hooks/useIsPwa';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { formFieldClassName } from '../../lib/ui/formFieldClassName';
import { OAuthSignInButtons } from './OAuthSignInButtons';
import { InstallAppBanner } from '../pwa/InstallAppBanner';
import { PasswordInput } from './PasswordInput';
import { PasskeyLoginButton } from './PasskeyLoginButton';

type MobileLoginFlowProps = {
  callbackUrl?: string;
  className?: string;
  initialEmail?: string;
  registerHref?: string;
};

type MobileLoginView = 'passkey' | 'password' | 'gate';

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
  const passkeyHint = useMemo(() => getDevicePasskeyHint(), []);
  const isPwa = useIsPwa();
  const { isMobile } = useDeviceDetection();
  const loginChannel = isPwa ? 'pwa' : isMobile ? 'mobile-web' : 'desktop-web';
  const hasConfiguredPasskey = Boolean(passkeyHint?.credentialId);
  // Users with a passkey already enabled on this phone see it first (like Mercado Pago).
  // Everyone else lands on the "gate" screen (activate biometrics / download the app)
  // instead of jumping straight to email/password — logging in with password is still
  // available from there as a fallback.
  const [view, setView] = useState<MobileLoginView>(hasConfiguredPasskey ? 'passkey' : 'gate');

  useEffect(() => {
    const hint = getDevicePasskeyHint();
    if (hint?.email) {
      setEmail(hint.email);
    } else if (initialEmail.trim()) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  async function completePasswordLogin() {
    setError(null);
    setLoading(true);

    const step1Res = await fetch('/api/auth/login/step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, channel: loginChannel })
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
      if (step1Data.error === 'CUENTA_BLOQUEADA') {
        setError(t.access.accountLocked);
        return;
      }
      if (step1Data.error === 'INVESTOR_ACCESS_NOT_ENABLED') {
        setError(t.access.investorAccessNotEnabled);
        return;
      }
      if (step1Data.error === 'OAUTH_ONLY_SIGN_IN_REQUIRED') {
        setError(t.access.oauthOnlySignInRequired);
        return;
      }
      setError(t.access.invalidCredentials);
      return;
    }

    if (step1Data.requiresTOTP && step1Data.tempToken) {
      const params = new URLSearchParams({
        t: step1Data.tempToken,
        callbackUrl
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

    router.refresh();
    router.push(callbackUrl);
  }

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await completePasswordLogin();
  }

  if (view === 'gate') {
    return (
      <div className={`space-y-5 ${className}`}>
        <div className="text-center">
          <h2 className="text-base font-semibold text-slate-900">{t.access.mobileGateTitle}</h2>
          <p className="mt-1 text-sm text-slate-600">{t.access.mobileGateDesc}</p>
        </div>

        <button
          type="button"
          onClick={() => setView('password')}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
        >
          <Fingerprint size={18} aria-hidden />
          {t.access.mobileGateActivateBiometric}
        </button>
        <p className="-mt-3 text-center text-xs text-slate-500">{t.access.mobileGateActivateBiometricDesc}</p>

        <InstallAppBanner />

        <OAuthSignInButtons callbackUrl={callbackUrl} className="pt-1" />

        <div className="flex flex-col items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setView('password')}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            {t.access.mobileGateSkip}
          </button>
          <Link
            href="/acceso/olvidar"
            className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
          >
            {t.access.forgotPassword}
          </Link>
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

  if (view === 'passkey' && hasConfiguredPasskey) {
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
        {/* Soft, non-blocking reminder: biometric login never requires the app to be
            installed, but we keep nudging until it is (see plan: "incentivo, no bloqueo"). */}
        <InstallAppBanner />
        <div className="flex flex-col items-center justify-center gap-2">
          <Link
            href="/acceso/olvidar"
            className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
          >
            {t.access.forgotPassword}
          </Link>
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
      <OAuthSignInButtons callbackUrl={callbackUrl} />

      <form onSubmit={handlePasswordLogin} className="space-y-4">
      <button
        type="button"
        onClick={() => {
          setView(hasConfiguredPasskey ? 'passkey' : 'gate');
          setError(null);
        }}
        className="text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        ← {t.access.backButton}
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

      <div className="flex items-center justify-center">
        <Link
          href={registerHref}
          className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
        >
          {t.access.notRegisteredYet}
        </Link>
      </div>
    </form>
    </div>
  );
}
