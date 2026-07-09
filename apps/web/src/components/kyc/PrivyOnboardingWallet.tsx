'use client';

import { Loader2, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrivyEmbeddedWallet } from '../../hooks/usePrivyEmbeddedWallet';
import { useTranslation } from '../../i18n/LocaleProvider';
import { isPrivyEnabled } from '../../lib/privy/config';

type PrivyOnboardingWalletProps = {
  kycApproved: boolean;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  onLinked: () => void | Promise<void>;
  onError: (message: string) => void;
};

/**
 * Post-Didit wallet step: silently provisions Privy embedded wallet on Base
 * and links it to the KYC-approved NextAuth session (Web2 UX).
 */
export function PrivyOnboardingWallet({
  kycApproved,
  refresh,
  onLinked,
  onError
}: PrivyOnboardingWalletProps) {
  const t = useTranslation();
  const o = t.onboarding.steps;
  const errors = t.onboarding.errors;
  const { enabled, ready, authenticated, login, ensureReady, getAccessToken } = usePrivyEmbeddedWallet();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'login' | 'linking' | 'done' | 'failed'>('idle');
  const [localError, setLocalError] = useState<string | null>(null);
  const autoStartRef = useRef(false);
  const manualRetryRef = useRef(false);

  const resolveErrorMessage = useCallback(
    (key: string) => errors[key as keyof typeof errors] ?? errors.GENERIC,
    [errors]
  );

  const reportClientError = useCallback((context: string, err: unknown) => {
    const payload = {
      context,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    };
    // Best-effort beacon — this is currently our only visibility into
    // client-only failures (e.g. Privy SDK errors) that never hit a backend
    // route. Never let this block the actual error handling.
    void fetch('/api/onboarding/client-error', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => undefined);
  }, []);

  const fail = useCallback(
    (key: string) => {
      const message = resolveErrorMessage(key);
      setLocalError(message);
      setPhase('failed');
      autoStartRef.current = false;
      onError(message);
    },
    [onError, resolveErrorMessage]
  );

  const provisionAndLink = useCallback(async () => {
    if (!enabled) {
      fail('PRIVY_NOT_CONFIGURED');
      return;
    }

    if (!kycApproved) {
      fail('KYC_NOT_APPROVED');
      return;
    }

    setLocalError(null);
    setBusy(true);
    setPhase('login');

    try {
      if (!ready || !authenticated) {
        try {
          await login();
        } catch (err) {
          console.error('[PrivyOnboardingWallet] login() failed', err);
          reportClientError('login', err);
          throw new Error('PRIVY_LOGIN_FAILED');
        }
      }

      setPhase('linking');
      const address = await ensureReady();

      let privyAccessToken: string | null = null;
      try {
        privyAccessToken = await getAccessToken();
      } catch (err) {
        // Best-effort: the token is only used to sync email verification.
        // A failure here shouldn't block wallet linking itself.
        console.warn('[PrivyOnboardingWallet] getAccessToken failed, continuing without it', err);
      }

      const response = await fetch('/api/investor/wallet', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          walletProvider: 'Privy Wallet',
          privyProvisioned: true,
          ...(privyAccessToken ? { privyAccessToken } : {})
        })
      });

      const data = (await response.json()) as { error?: string; walletAddress?: string };

      if (!response.ok) {
        fail(data.error ?? 'GENERIC');
        return;
      }

      setPhase('done');
      await refresh({ silent: true });
      await onLinked();
    } catch (err) {
      console.error('[PrivyOnboardingWallet] provisioning failed', err);
      if (!(err instanceof Error && err.message === 'PRIVY_LOGIN_FAILED')) {
        reportClientError('provisionAndLink', err);
      }
      fail(err instanceof Error ? err.message : 'GENERIC');
    } finally {
      setBusy(false);
    }
  }, [
    authenticated,
    enabled,
    ensureReady,
    fail,
    getAccessToken,
    kycApproved,
    login,
    onLinked,
    ready,
    refresh,
    reportClientError
  ]);

  useEffect(() => {
    if (!isPrivyEnabled() || !kycApproved || phase !== 'idle' || busy) {
      return;
    }

    if (autoStartRef.current && !manualRetryRef.current) {
      return;
    }

    autoStartRef.current = true;
    manualRetryRef.current = false;
    void provisionAndLink();
  }, [busy, kycApproved, phase, provisionAndLink]);

  if (!isPrivyEnabled()) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {o.walletDesc}
      </p>
    );
  }

  const showRetry = phase === 'failed' && !busy;
  const showSpinner = busy || (phase !== 'done' && phase !== 'failed');

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600">
          <Wallet size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold">{o.walletTitle}</h2>
          <p className="text-sm text-slate-600">{o.walletDesc}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <ShieldCheck className="mt-0.5 shrink-0" size={18} />
        <p>{o.walletBullet1}</p>
      </div>

      {localError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{localError}</p>
      ) : null}

      {showRetry ? (
        <button
          type="button"
          onClick={() => {
            manualRetryRef.current = true;
            autoStartRef.current = false;
            setPhase('idle');
          }}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-semibold text-white hover:bg-blue-500"
        >
          <RefreshCw size={20} />
          {o.walletRetry}
        </button>
      ) : showSpinner ? (
        <div className="flex min-h-14 items-center justify-center rounded-2xl bg-blue-600 px-4 py-4 text-base font-semibold text-white">
          <Loader2 className="mr-2 animate-spin" size={20} />
          {o.walletSaving}
        </div>
      ) : (
        <div className="flex min-h-14 items-center justify-center rounded-2xl bg-blue-600 px-4 py-4 text-base font-semibold text-white">
          {o.walletLinked}
        </div>
      )}

      <p className="text-center text-xs text-slate-500">{o.walletHint}</p>
    </section>
  );
}
