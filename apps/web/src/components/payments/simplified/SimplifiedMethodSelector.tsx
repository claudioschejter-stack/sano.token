'use client';

import { Building2, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { CheckoutBestRoutes } from '../../../lib/payments/checkoutBestRouteService';

export type SimplifiedMethod = 'fiat_wallet' | 'crypto_wallet' | 'card' | 'wire';

type Props = {
  routes: CheckoutBestRoutes;
  selected: SimplifiedMethod | null;
  onSelect: (method: SimplifiedMethod) => void;
  loading?: boolean;
};

function formatLocalAmount(totalLocal: number, displayCurrency: string): string {
  if (!Number.isFinite(totalLocal)) return '…';
  const locale = displayCurrency === 'USD' ? 'en-US' : 'es-AR';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: displayCurrency,
    maximumFractionDigits: 2
  }).format(totalLocal);
}

export function SimplifiedMethodSelector({ routes, selected, onSelect, loading }: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;

  const methods: {
    id: SimplifiedMethod;
    label: string;
    subLabel: string;
    Icon: typeof CreditCard;
  }[] = [
    {
      id: 'fiat_wallet',
      label: sc.fiatWallet,
      subLabel: formatLocalAmount(routes.fiatWallet.totalLocal, routes.fiatWallet.displayCurrency),
      Icon: Smartphone
    },
    {
      id: 'crypto_wallet',
      label: sc.cryptoWallet,
      subLabel: `${routes.cryptoWallet.totalUsd.toFixed(2)} USDC`,
      Icon: Wallet
    },
    {
      id: 'card',
      label: sc.card,
      subLabel: formatLocalAmount(routes.card.totalLocal, routes.card.displayCurrency),
      Icon: CreditCard
    },
    {
      id: 'wire',
      label: sc.wire,
      subLabel: `USD ${routes.wire.totalUsd.toFixed(2)}`,
      Icon: Building2
    }
  ];

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-terminal-muted">
        {sc.selectMethod}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {methods.map(({ id, label, subLabel, Icon }) => {
          const isActive = selected === id;
          return (
            <button
              key={id}
              type="button"
              disabled={loading}
              onClick={() => onSelect(id)}
              className={[
                'flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-all',
                isActive
                  ? 'border-terminal-primary bg-terminal-primary/10 shadow-sm'
                  : 'border-terminal-border bg-white hover:border-terminal-primary/40 hover:bg-gray-50',
                loading ? 'cursor-wait opacity-60' : 'cursor-pointer'
              ].join(' ')}
            >
              <Icon
                className={`h-4 w-4 ${isActive ? 'text-terminal-primary' : 'text-terminal-muted'}`}
              />
              <span
                className={`text-xs font-semibold leading-tight ${
                  isActive ? 'text-terminal-primary' : 'text-terminal-text'
                }`}
              >
                {label}
              </span>
              <span className="text-[11px] font-medium text-terminal-muted">{subLabel}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-terminal-muted">{sc.feesNote}</p>
    </div>
  );
}
