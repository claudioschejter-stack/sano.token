'use client';

import { useEffect, useState } from 'react';
import { Landmark, Star, Wallet } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { BridgeExternalAccountForm } from './BridgeExternalAccountForm';

type LinkedCryptoWalletDto = {
  id: string;
  address: string;
  network: string;
  provider: string;
  label: string | null;
  isDefault: boolean;
  linkedAt: string;
  lastUsedAt: string | null;
};

type LinkedFiatIdentityDto = {
  id: string;
  provider: string;
  identifier: string;
  label: string | null;
  createdAt: string;
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function providerLabel(provider: string, lw: { bridgeProvider: string }): string {
  const known: Record<string, string> = {
    mercado_pago: 'Mercado Pago',
    ripio: 'Ripio',
    bridge: lw.bridgeProvider
  };
  return known[provider] ?? provider;
}

/** History of wallets/billeteras + Bridge external bank accounts for payouts. */
export function LinkedWalletsPanel() {
  const t = useTranslation();
  const lw = t.linkedWallets;
  const [cryptoWallets, setCryptoWallets] = useState<LinkedCryptoWalletDto[] | null>(null);
  const [fiatIdentities, setFiatIdentities] = useState<LinkedFiatIdentityDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingAddress, setSwitchingAddress] = useState<string | null>(null);
  const [showBridgeForm, setShowBridgeForm] = useState(false);

  async function load() {
    try {
      const response = await fetch('/api/wallet/linked-wallets', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as {
        cryptoWallets?: LinkedCryptoWalletDto[];
        fiatIdentities?: LinkedFiatIdentityDto[];
      };
      setCryptoWallets(data.cryptoWallets ?? []);
      setFiatIdentities(data.fiatIdentities ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function useAsDefault(address: string) {
    setSwitchingAddress(address);
    try {
      const response = await fetch('/api/wallet/linked-wallets/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      if (response.ok) {
        await load();
      }
    } finally {
      setSwitchingAddress(null);
    }
  }

  const bridgeIdentities = fiatIdentities?.filter((row) => row.provider === 'bridge') ?? [];
  const otherFiat = fiatIdentities?.filter((row) => row.provider !== 'bridge') ?? [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Wallet size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">{lw.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{lw.subtitle}</p>

          {loading ? (
            <div className="mt-4 h-16 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <div className="mt-4 space-y-3">
              {cryptoWallets && cryptoWallets.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{lw.cryptoSection}</p>
                  <ul className="mt-2 space-y-2">
                    {cryptoWallets.map((wallet) => (
                      <li
                        key={wallet.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-slate-700">{shortAddress(wallet.address)}</p>
                          <p className="text-xs text-slate-400">
                            {wallet.provider} · {wallet.network}
                          </p>
                        </div>
                        {wallet.isDefault ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                            <Star size={12} />
                            {lw.defaultBadge}
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={switchingAddress === wallet.address}
                            onClick={() => void useAsDefault(wallet.address)}
                            className="shrink-0 rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
                          >
                            {switchingAddress === wallet.address ? lw.switching : lw.useThisWallet}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {bridgeIdentities.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{lw.bridgeSection}</p>
                  <ul className="mt-2 space-y-2">
                    {bridgeIdentities.map((identity) => (
                      <li
                        key={identity.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <Landmark size={16} className="shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-700">
                            {identity.label ?? identity.identifier}
                          </p>
                          <p className="text-xs text-slate-400">{providerLabel(identity.provider, lw)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {otherFiat.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{lw.fiatSection}</p>
                  <ul className="mt-2 space-y-2">
                    {otherFiat.map((identity) => (
                      <li
                        key={identity.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <Landmark size={16} className="shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-700">
                            {identity.label ?? identity.identifier}
                          </p>
                          <p className="text-xs text-slate-400">{providerLabel(identity.provider, lw)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!showBridgeForm ? (
                <button
                  type="button"
                  onClick={() => setShowBridgeForm(true)}
                  className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700"
                >
                  {lw.bridgeAddCta}
                </button>
              ) : (
                <BridgeExternalAccountForm
                  onLinked={() => {
                    setShowBridgeForm(false);
                    void load();
                  }}
                />
              )}

              <p className="text-xs text-slate-400">{lw.hint}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
