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
    color: string;
    bgColor: string;
  }[] = [
    {
      id: 'fiat_wallet',
      label: sc.fiatWallet,
      subLabel: formatLocalAmount(routes.fiatWallet.totalLocal, routes.fiatWallet.displayCurrency),
      Icon: Smartphone,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10'
    },
    {
      id: 'crypto_wallet',
      label: sc.cryptoWallet,
      subLabel: `${routes.cryptoWallet.totalUsd.toFixed(2)} USDC`,
      Icon: Wallet,
      color: 'text-terminal-primary',
      bgColor: 'bg-terminal-primary/10'
    },
    {
      id: 'card',
      label: sc.card,
      subLabel: formatLocalAmount(routes.card.totalLocal, routes.card.displayCurrency),
      Icon: CreditCard,
      color: 'text-violet-400',
      bgColor: 'bg-violet-400/10'
    },
    {
      id: 'wire',
      label: sc.wire,
      subLabel: `USD ${routes.wire.totalUsd.toFixed(2)}`,
      Icon: Building2,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10'
    }
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-terminal-muted">
        {sc.selectMethod}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {methods.map(({ id, label, subLabel, Icon, color, bgColor }) => {
          const isActive = selected === id;
          return (
            <button
              key={id}
              type="button"
              disabled={loading}
              onClick={() => onSelect(id)}
              className={[
                'group relative flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all duration-150',
                isActive
                  ? 'border-terminal-primary bg-terminal-primary/10 shadow-md shadow-terminal-primary/10 ring-1 ring-terminal-primary/30'
                  : 'border-terminal-border bg-terminal-card hover:border-terminal-primary/40 hover:bg-terminal-bg',
                loading ? 'cursor-wait opacity-60' : 'cursor-pointer'
              ].join(' ')}
            >
              {isActive && (
                <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-terminal-primary shadow-lg shadow-terminal-primary/50" />
              )}
              <div className={`rounded-lg p-1.5 ${isActive ? 'bg-terminal-primary/20 text-terminal-primary' : `${bgColor} ${color}`}`}>
                <Icon size={16} />
              </div>
              <div>
                <span className={`block text-xs font-semibold leading-tight ${isActive ? 'text-terminal-primary' : 'text-terminal-text'}`}>
                  {label}
                </span>
                <span className="mt-0.5 block text-[11px] font-medium leading-snug text-terminal-muted">
                  {subLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-terminal-muted">{sc.feesNote}</p>
    </div>
  );
}
