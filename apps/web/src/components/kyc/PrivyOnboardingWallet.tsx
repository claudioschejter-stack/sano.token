'use client';

import { Loader2, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { isPrivyEnabled } from '../../lib/privy/config';

type PrivyOnboardingWalletProps = {
  kycApproved: boolean;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  onLinked: () => void | Promise<void>;
  onError: (message: string) => void;
};

const MAX_AUTO_RETRIES = 5;
const RETRY_DELAY_MS = [1500, 2500, 4000, 6000, 9000];

// Errors that are worth retrying automatically (transient Privy API hiccups,
// not fixable by the investor) vs. errors that need a clear, non-retryable
// message (e.g. a duplicate identity document).
const NON_RETRYABLE_ERRORS = new Set([
  'DOCUMENT_ALREADY_REGISTERED',
  'WALLET_ALREADY_LINKED',
  'PRIVY_NOT_CONFIGURED',
  'KYC_NOT_APPROVED',
  'EMAIL_VERIFICATION_REQUIRED',
  'UNAUTHORIZED'
]);

/**
 * Post-Didit wallet step: silently provisions the Privy embedded wallet on
 * Base entirely server-side and links it to the KYC-approved session.
 *
 * Deliberately never touches the Privy client SDK (`usePrivy().login()`)
 * here — without paid Custom Auth, that call pops Privy's own "log in with
 * email" modal, forcing the investor through a second, redundant login.
 * The wallet is created via Privy's REST API (server-side, by email) and
 * simply linked to the account through our own backend.
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
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'provisioning' | 'done' | 'failed'>('idle');
  const [localError, setLocalError] = useState<string | null>(null);
  const autoStartRef = useRef(false);
  const manualRetryRef = useRef(false);
  const autoRetryCountRef = useRef(0);

  const resolveErrorMessage = useCallback(
    (key: string) => errors[key as keyof typeof errors] ?? errors.GENERIC,
    [errors]
  );

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

  const provisionWallet = useCallback(async () => {
    if (!isPrivyEnabled()) {
      fail('PRIVY_NOT_CONFIGURED');
      return;
    }

    if (!kycApproved) {
      fail('KYC_NOT_APPROVED');
      return;
    }

    setLocalError(null);
    setBusy(true);
    setPhase('provisioning');

    try {
      const response = await fetch('/api/investor/wallet/provision', {
        method: 'POST',
        credentials: 'same-origin'
      });

      const data = (await response.json()) as { error?: string; walletAddress?: string };

      if (!response.ok) {
        const key = data.error ?? 'GENERIC';

        if (!NON_RETRYABLE_ERRORS.has(key) && autoRetryCountRef.current < MAX_AUTO_RETRIES) {
          const delay = RETRY_DELAY_MS[autoRetryCountRef.current] ?? RETRY_DELAY_MS[RETRY_DELAY_MS.length - 1];
          autoRetryCountRef.current += 1;
          setBusy(false);
          setTimeout(() => {
            autoStartRef.current = false;
            setPhase('idle');
          }, delay);
          return;
        }

        fail(key);
        return;
      }

      setPhase('done');
      await refresh({ silent: true });
      await onLinked();
    } catch {
      if (autoRetryCountRef.current < MAX_AUTO_RETRIES) {
        const delay = RETRY_DELAY_MS[autoRetryCountRef.current] ?? RETRY_DELAY_MS[RETRY_DELAY_MS.length - 1];
        autoRetryCountRef.current += 1;
        setBusy(false);
        setTimeout(() => {
          autoStartRef.current = false;
          setPhase('idle');
        }, delay);
        return;
      }

      fail('GENERIC');
    } finally {
      setBusy(false);
    }
  }, [fail, kycApproved, onLinked, refresh]);

  useEffect(() => {
    if (!isPrivyEnabled() || !kycApproved || phase !== 'idle' || busy) {
      return;
    }

    if (autoStartRef.current && !manualRetryRef.current) {
      return;
    }

    autoStartRef.current = true;
    manualRetryRef.current = false;
    void provisionWallet();
  }, [busy, kycApproved, phase, provisionWallet]);

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
            autoRetryCountRef.current = 0;
            setPhase('idle');
          }}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-semibold text-white hover:bg-blue-500"
        >
          <RefreshCw size={20} />
          {o.walletRetry}
        </button>
      ) : showSpinner ? (
        // Deliberately NOT the same solid blue as a real button — this is a
        // status indicator, not something to tap, and the two were getting
        // confused with each other.
        <div className="flex min-h-14 items-center justify-center rounded-2xl bg-sky-500 px-4 py-4 text-base font-semibold text-white">
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
