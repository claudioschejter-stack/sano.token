'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';

type OAuthProvidersResponse = {
  google: boolean;
  apple: boolean;
};

type OAuthSignInButtonsProps = {
  callbackUrl: string;
  className?: string;
};

export function OAuthSignInButtons({ callbackUrl, className = '' }: OAuthSignInButtonsProps) {
  const t = useTranslation();
  const [providers, setProviders] = useState<OAuthProvidersResponse>({ google: false, apple: false });
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

  useEffect(() => {
    void fetch('/api/auth/oauth-providers', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { google: false, apple: false }))
      .then((data: OAuthProvidersResponse) => setProviders(data))
      .catch(() => setProviders({ google: false, apple: false }));
  }, []);

  if (!providers.google && !providers.apple) {
    return null;
  }

  async function handleOAuthSignIn(provider: 'google' | 'apple') {
    setLoadingProvider(provider);
    await signIn(provider, { callbackUrl });
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {providers.google ? (
        <button
          type="button"
          disabled={loadingProvider !== null}
          onClick={() => void handleOAuthSignIn('google')}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingProvider === 'google' ? t.access.oauthSigningIn : t.access.oauthGoogle}
        </button>
      ) : null}

      {providers.apple ? (
        <button
          type="button"
          disabled={loadingProvider !== null}
          onClick={() => void handleOAuthSignIn('apple')}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingProvider === 'apple' ? t.access.oauthSigningIn : t.access.oauthApple}
        </button>
      ) : null}

      <p className="text-center text-xs text-slate-400">{t.passkey.orDivider}</p>
    </div>
  );
}
