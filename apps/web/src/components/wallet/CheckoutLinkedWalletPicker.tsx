'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';

type LinkedCryptoWalletDto = {
  id: string;
  address: string;
  network: string;
  provider: string;
  isDefault: boolean;
};

type Props = {
  /** Called after the active (default) wallet changes so checkout can refresh guards. */
  onDefaultChanged?: () => void | Promise<void>;
};

/**
 * Shown in USDC checkout when the investor has more than one linked crypto wallet,
 * so they can pick which address pays before continuing.
 */
export function CheckoutLinkedWalletPicker({ onDefaultChanged }: Props) {
  const t = useTranslation();
  const lw = t.linkedWallets;
  const [wallets, setWallets] = useState<LinkedCryptoWalletDto[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/wallet/linked-wallets', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { cryptoWallets?: LinkedCryptoWalletDto[] };
      setWallets(data.cryptoWallets ?? []);
    })();
  }, []);

  if (wallets.length < 2) {
    return null;
  }

  async function selectWallet(address: string) {
    setSwitching(address);
    try {
      const response = await fetch('/api/wallet/linked-wallets/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      if (!response.ok) return;
      setWallets((prev) =>
        prev.map((row) => ({ ...row, isDefault: row.address.toLowerCase() === address.toLowerCase() }))
      );
      await onDefaultChanged?.();
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-terminal-border bg-terminal-bg/60 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-terminal-muted">{lw.cryptoSection}</p>
      <p className="text-xs text-terminal-muted">{lw.hint}</p>
      <ul className="space-y-2">
        {wallets.map((wallet) => (
          <li key={wallet.id}>
            <label
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                wallet.isDefault
                  ? 'border-terminal-primary bg-terminal-primary/10'
                  : 'border-terminal-border hover:bg-terminal-card'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="checkout-linked-wallet"
                  checked={wallet.isDefault}
                  disabled={switching != null}
                  onChange={() => void selectWallet(wallet.address)}
                />
                <span className="font-mono text-xs text-terminal-text">
                  {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
                </span>
              </span>
              <span className="text-xs text-terminal-muted">
                {switching === wallet.address ? lw.switching : wallet.provider}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
