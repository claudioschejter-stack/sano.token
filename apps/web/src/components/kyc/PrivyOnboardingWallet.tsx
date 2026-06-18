'use client';

import { Loader2, ShieldCheck, Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { usePrivyEmbeddedWallet } from '../../hooks/usePrivyEmbeddedWallet';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { useTranslation } from '../../i18n/LocaleProvider';
import { isPrivyEnabled } from '../../lib/privy/config';

type PrivyOnboardingWalletProps = {
  onLinked: () => void | Promise<void>;
  onError: (message: string) => void;
};

/**
 * Post-Didit wallet step: silently provisions Privy embedded wallet on Base
 * and links it to the KYC-approved NextAuth session (Web2 UX).
 */
export function PrivyOnboardingWallet({ onLinked, onError }: PrivyOnboardingWalletProps) {
  const t = useTranslation();
  const o = t.onboarding.steps;
  const { refresh, checklist } = useAccountStatus();
  const { enabled, ready, authenticated, login, ensureReady } = usePrivyEmbeddedWallet();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'login' | 'linking' | 'done'>('idle');

  const provisionAndLink = useCallback(async () => {
    if (!enabled) {
      onError(t.onboarding.errors.DIDIT_NOT_CONFIGURED ?? 'Privy not configured');
      return;
    }

    if (checklist && !checklist.kycApproved) {
      onError(t.onboarding.errors.KYC_NOT_APPROVED ?? 'Complete identity verification first');
      return;
    }

    setBusy(true);
    setPhase('login');

    try {
      if (!ready || !authenticated) {
        await login();
      }

      setPhase('linking');
      const address = await ensureReady();

      const response = await fetch('/api/investor/wallet', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          walletProvider: 'Privy Wallet',
          privyProvisioned: true
        })
      });

      const data = (await response.json()) as { error?: string; walletAddress?: string };

      if (!response.ok) {
        const key = data.error ?? 'GENERIC';
        onError(
          t.onboarding.errors[key as keyof typeof t.onboarding.errors] ?? t.onboarding.errors.GENERIC
        );
        return;
      }

      setPhase('done');
      await refresh({ silent: true });
      await onLinked();
    } catch {
      onError(t.onboarding.errors.GENERIC);
    } finally {
      setBusy(false);
    }
  }, [
    authenticated,
    checklist,
    enabled,
    ensureReady,
    login,
    onError,
    onLinked,
    ready,
    refresh,
    t.onboarding.errors
  ]);

  useEffect(() => {
    if (isPrivyEnabled() && checklist?.kycApproved && phase === 'idle') {
      void provisionAndLink();
    }
  }, [checklist?.kycApproved, phase, provisionAndLink]);

  if (!isPrivyEnabled()) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {o.walletDesc}
      </p>
    );
  }

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

      <div className="flex min-h-14 items-center justify-center rounded-2xl bg-blue-600 px-4 py-4 text-base font-semibold text-white">
        {busy || phase !== 'done' ? (
          <>
            <Loader2 className="mr-2 animate-spin" size={20} />
            {phase === 'login'
              ? o.walletSaving
              : phase === 'linking'
                ? o.walletSaving
                : o.walletSaving}
          </>
        ) : (
          o.walletLinked
        )}
      </div>

      <p className="text-center text-xs text-slate-500">
        {o.walletHint}
      </p>
    </section>
  );
}
