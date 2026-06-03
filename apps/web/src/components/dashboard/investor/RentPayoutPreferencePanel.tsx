'use client';

import { Banknote, CircleDollarSign, Loader2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '../../../i18n/LocaleProvider';
import { useLinkedWalletGuard } from '../../../hooks/useLinkedWalletGuard';
import { InvestorSection } from './InvestorSection';

type RentPayoutPreference = 'FIAT' | 'USDC';

export function RentPayoutPreferencePanel({ compact = false }: { compact?: boolean }) {
  const t = useTranslation();
  const w = t.wallet;
  const r = t.rentPayout;
  const router = useRouter();
  const walletGuard = useLinkedWalletGuard();

  const [preference, setPreference] = useState<RentPayoutPreference | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const loadPreference = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/investor/rent-payout-preference', { cache: 'no-store' });
      const data = (await response.json()) as { preference?: RentPayoutPreference; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'LOAD_FAILED');
      }

      setPreference(data.preference ?? 'FIAT');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : r.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [r.loadError]);

  useEffect(() => {
    void loadPreference();
  }, [loadPreference]);

  const savePreference = async (next: RentPayoutPreference) => {
    if (next === preference || isSaving) {
      return;
    }

    if (next === 'USDC' && !walletGuard.isWalletLinked) {
      router.push(
        '/marketplace/carrito?mode=wallet&returnTo=/dashboard&preference=USDC'
      );
      return;
    }

    if (next === 'USDC' && !walletGuard.canSignOnChain) {
      setError(walletGuard.isWrongNetwork ? w.wrongNetwork : walletGuard.isWalletMismatch ? w.walletMismatch : w.noWallet);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const response = await fetch('/api/investor/rent-payout-preference', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preference: next })
      });
      const data = (await response.json()) as { preference?: RentPayoutPreference; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'UPDATE_FAILED');
      }

      setPreference(data.preference ?? next);
      setSavedMessage(r.saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : r.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const options: Array<{
    value: RentPayoutPreference;
    title: string;
    description: string;
    icon: typeof Banknote;
  }> = [
    {
      value: 'FIAT',
      title: r.fiatTitle,
      description: r.fiatDescription,
      icon: Banknote
    },
    {
      value: 'USDC',
      title: r.usdcTitle,
      description: r.usdcDescription,
      icon: CircleDollarSign
    }
  ];

  const body = (
    <div className="space-y-4">
      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'md:grid-cols-2'}`}>
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = preference === option.value;

          return (
            <button
              key={option.value}
              type="button"
              disabled={isLoading || isSaving}
              onClick={() => void savePreference(option.value)}
              className={`rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? 'border-terminal-primary bg-terminal-primary/10'
                  : 'border-terminal-border bg-terminal-bg hover:border-terminal-primary/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-lg border border-terminal-border bg-terminal-card p-2 text-terminal-primary">
                  <Icon size={18} />
                </div>
                {isSelected ? (
                  <span className="rounded-full border border-terminal-primary/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-terminal-primary">
                    {r.activeBadge}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-terminal-text">{option.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-terminal-muted">{option.description}</p>
            </button>
          );
        })}
      </div>

      {preference === 'USDC' ? (
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-terminal-border bg-terminal-card p-2 text-terminal-muted">
                <Wallet size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-terminal-text">{r.walletTitle}</p>
                <p className="mt-1 text-xs text-terminal-muted">
                  {walletGuard.linkedWallet
                    ? r.walletConnected.replace(
                        '{address}',
                        `${walletGuard.linkedWallet.slice(0, 6)}…${walletGuard.linkedWallet.slice(-4)}`
                      )
                    : r.walletHint}
                </p>
              </div>
            </div>
            {!walletGuard.isWalletLinked ? (
              <Link
                href="/marketplace/carrito?mode=wallet&returnTo=/dashboard&preference=USDC"
                className="inline-flex rounded-lg bg-terminal-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                {r.linkWalletInCheckout}
              </Link>
            ) : null}
            {walletGuard.isWalletMismatch ? (
              <p className="text-xs font-medium text-terminal-warning">{w.walletMismatch}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <p className="inline-flex items-center gap-2 text-xs text-terminal-muted">
          <Loader2 size={14} className="animate-spin" />
          {t.common.loadingGeneric}
        </p>
      ) : null}

      {savedMessage ? <p className="text-xs font-medium text-terminal-success">{savedMessage}</p> : null}
      {error ? <p className="text-xs font-medium text-terminal-warning">{error}</p> : null}
    </div>
  );

  if (compact) {
    return body;
  }

  return (
    <InvestorSection title={r.title} subtitle={r.subtitle}>
      {body}
    </InvestorSection>
  );
}
