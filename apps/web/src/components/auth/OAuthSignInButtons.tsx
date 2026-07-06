'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { OAUTH_TERMS_COOKIE } from '../../lib/auth/oauthRegistrationPolicy';

type OAuthProvidersResponse = {
  google: boolean;
  apple: boolean;
};

type OAuthSignInButtonsProps = {
  callbackUrl: string;
  className?: string;
  mode?: 'login' | 'register';
  termsAccepted?: boolean;
  hideTermsCheckbox?: boolean;
  onTermsRequired?: () => void;
  onProvidersLoaded?: (hasProviders: boolean) => void;
};

function setOAuthTermsCookie() {
  document.cookie = `${OAUTH_TERMS_COOKIE}=1; path=/; max-age=1800; SameSite=Lax`;
}

export function OAuthSignInButtons({
  callbackUrl,
  className = '',
  mode = 'login',
  termsAccepted: controlledTermsAccepted,
  hideTermsCheckbox = false,
  onTermsRequired,
  onProvidersLoaded
}: OAuthSignInButtonsProps) {
  const t = useTranslation();
  const a = t.access;
  const legal = t.legal;
  const [providers, setProviders] = useState<OAuthProvidersResponse>({ google: false, apple: false });
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);
  const [internalTermsAccepted, setInternalTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);

  const termsAccepted = controlledTermsAccepted ?? internalTermsAccepted;
  const showTermsCheckbox = !hideTermsCheckbox;

  useEffect(() => {
    void fetch('/api/auth/oauth-providers', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { google: false, apple: false }))
      .then((data: OAuthProvidersResponse) => setProviders(data))
      .catch(() => setProviders({ google: false, apple: false }));
  }, []);

  useEffect(() => {
    onProvidersLoaded?.(providers.google || providers.apple);
  }, [onProvidersLoaded, providers.apple, providers.google]);

  useEffect(() => {
    function resetLoading() {
      setLoadingProvider(null);
    }

    window.addEventListener('focus', resetLoading);
    window.addEventListener('pageshow', resetLoading);
    return () => {
      window.removeEventListener('focus', resetLoading);
      window.removeEventListener('pageshow', resetLoading);
    };
  }, []);

  if (!providers.google && !providers.apple) {
    return null;
  }

  async function handleOAuthSignIn(provider: 'google' | 'apple') {
    if (!termsAccepted) {
      if (onTermsRequired) {
        onTermsRequired();
      } else {
        setTermsError(a.register.termsAcceptRequired);
      }
      return;
    }

    setTermsError(null);
    setOAuthTermsCookie();
    setLoadingProvider(provider);
    try {
      await signIn(provider, { callbackUrl });
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {mode === 'register' ? (
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-slate-500">{a.register.oauthOrContinue}</span>
          </div>
        </div>
      ) : null}

      {showTermsCheckbox ? (
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs leading-relaxed text-slate-700">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => {
              if (controlledTermsAccepted === undefined) {
                setInternalTermsAccepted(event.target.checked);
              }
              if (event.target.checked) {
                setTermsError(null);
              }
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            {a.register.termsAcceptLabel}{' '}
            <Link href="/terminos" className="font-semibold text-blue-600 hover:text-blue-500">
              {a.register.termsLinkLabel}
            </Link>
            {' · '}
            <Link href="/privacidad" className="font-semibold text-blue-600 hover:text-blue-500">
              {a.register.privacyLinkLabel}
            </Link>
          </span>
        </label>
      ) : null}

      {termsError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{termsError}</p>
      ) : null}

      {providers.google ? (
        <button
          type="button"
          disabled={loadingProvider !== null}
          onClick={() => void handleOAuthSignIn('google')}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingProvider === 'google' ? a.oauthSigningIn : a.oauthGoogle}
        </button>
      ) : null}

      {providers.apple ? (
        <button
          type="button"
          disabled={loadingProvider !== null}
          onClick={() => void handleOAuthSignIn('apple')}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingProvider === 'apple' ? a.oauthSigningIn : a.oauthApple}
        </button>
      ) : null}

      <p className="text-center text-xs text-slate-400">{legal.loginNotice}</p>
      {mode === 'login' ? (
        <p className="text-center text-xs text-slate-400">{t.passkey.orDivider}</p>
      ) : null}
    </div>
  );
}
