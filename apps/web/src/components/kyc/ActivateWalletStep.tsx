'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Loader2, Wallet } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useTranslation } from '../../i18n/LocaleProvider';
import { BASE_CHAIN_ID, isWalletConnectConfigured } from '../../lib/web3/config';

type ActivateWalletStepProps = {
  onLinked: () => void | Promise<void>;
  onError: (message: string) => void;
};

export function ActivateWalletStep({ onLinked, onError }: ActivateWalletStepProps) {
  const t = useTranslation();
  const o = t.onboarding.steps;
  const w = t.wallet;
  const { address, isConnected, isConnecting, chainId } = useAccount();
  const [saving, setSaving] = useState(false);
  const savedAddressRef = useRef<string | null>(null);

  const linkWallet = useCallback(
    async (walletAddress: string) => {
      if (savedAddressRef.current === walletAddress.toLowerCase()) {
        return;
      }

      setSaving(true);

      try {
        const response = await fetch('/api/investor/wallet', {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress })
        });

        const data = (await response.json()) as { error?: string; walletAddress?: string };

        if (!response.ok) {
          const errorKey = data.error ?? 'GENERIC';
          onError(t.onboarding.errors[errorKey as keyof typeof t.onboarding.errors] ?? t.onboarding.errors.GENERIC);
          return;
        }

        savedAddressRef.current = (data.walletAddress ?? walletAddress).toLowerCase();
        await onLinked();
      } catch {
        onError(t.onboarding.errors.GENERIC);
      } finally {
        setSaving(false);
      }
    },
    [onError, onLinked, t.onboarding.errors]
  );

  useEffect(() => {
    if (!isConnected || !address) {
      return;
    }

    if (chainId != null && chainId !== BASE_CHAIN_ID) {
      onError(w.wrongNetwork);
      return;
    }

    void linkWallet(address);
  }, [address, chainId, isConnected, linkWallet, onError, w.wrongNetwork]);

  const connectLabel = isWalletConnectConfigured ? w.connect : w.connectCoinbase;
  const busy = isConnecting || saving;

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

      <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        <li>{o.walletBullet1}</li>
        <li>{o.walletBullet2}</li>
        <li>{o.walletBullet3}</li>
      </ul>

      <ConnectButton.Custom>
        {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
          const ready = mounted;
          const connected = ready && account && chain;

          if (!connected) {
            return (
              <button
                type="button"
                onClick={openConnectModal}
                disabled={!ready || busy}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-semibold text-white disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    {saving ? o.walletSaving : w.connecting}
                  </>
                ) : (
                  connectLabel
                )}
              </button>
            );
          }

          if (chain.unsupported) {
            return (
              <button
                type="button"
                onClick={openChainModal}
                className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-base font-semibold text-amber-800"
              >
                {w.wrongNetwork}
              </button>
            );
          }

          return (
            <button
              type="button"
              onClick={openAccountModal}
              disabled={busy}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-base font-semibold text-emerald-800 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  {o.walletSaving}
                </>
              ) : (
                <>
                  {o.walletLinked}: {account.displayName}
                </>
              )}
            </button>
          );
        }}
      </ConnectButton.Custom>

      <p className="text-center text-xs text-slate-500">{o.walletHint}</p>
    </section>
  );
}
