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

/** Returns a localised wallet group label based on the user's country. */
function getLocalWalletLabel(country: string): string {
  const map: Record<string, string> = {
    AR: 'Billeteras Digitales (Argentina)',
    BR: 'Carteiras Digitais (Brasil)',
    MX: 'Billeteras Digitales (México)',
    CO: 'Billeteras Digitales (Colombia)',
    PE: 'Billeteras Digitales (Perú)',
    CL: 'Billeteras Digitales (Chile)',
    UY: 'Billeteras Digitales (Uruguay)',
    PY: 'Billeteras Digitales (Paraguay)',
    BO: 'Billeteras Digitales (Bolivia)',
    VE: 'Billeteras Digitales (Venezuela)',
    EC: 'Billeteras Digitales (Ecuador)',
    US: 'Digital Wallets (USA)',
    CA: 'Digital Wallets (Canada)',
    GB: 'Digital Wallets (UK)',
    DE: 'Digital Wallets (Deutschland)',
    FR: 'Portefeuilles Numériques (France)',
    ES: 'Billeteras Digitales (España)',
    IN: 'Digital Wallets (India)',
    NG: 'Digital Wallets (Nigeria)',
    KE: 'Digital Wallets (Kenya)',
    ZA: 'Digital Wallets (South Africa)',
    JP: 'デジタルウォレット (日本)',
    CN: '数字钱包 (中国)',
    ID: 'Dompet Digital (Indonesia)',
    PH: 'Digital Wallets (Philippines)',
    TH: 'กระเป๋าเงินดิจิทัล (ไทย)',
    MY: 'Digital Wallets (Malaysia)',
    SG: 'Digital Wallets (Singapore)',
    TK: 'Digital Wallets (Turkey)',
    EG: 'المحافظ الرقمية (مصر)',
    SA: 'المحافظ الرقمية (السعودية)',
    AE: 'Digital Wallets (UAE)',
    AU: 'Digital Wallets (Australia)',
    NZ: 'Digital Wallets (New Zealand)',
    PK: 'Digital Wallets (Pakistan)',
    BD: 'ডিজিটাল ওয়ালেট (বাংলাদেশ)',
  };
  return map[country.toUpperCase()] ?? 'Billeteras Digitales';
}

export function SimplifiedMethodSelector({ routes, selected, onSelect, loading }: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;

  const methods: {
    id: SimplifiedMethod;
    label: string;
    amount: string;
    Icon: typeof CreditCard;
    color: string;
    bgColor: string;
  }[] = [
    {
      id: 'fiat_wallet',
      label: getLocalWalletLabel(routes.country),
      amount: formatLocalAmount(routes.fiatWallet.totalLocal, routes.fiatWallet.displayCurrency),
      Icon: Smartphone,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10'
    },
    {
      id: 'crypto_wallet',
      label: sc.cryptoWallet,
      amount: `${routes.cryptoWallet.totalUsd.toFixed(2)} USDC`,
      Icon: Wallet,
      color: 'text-terminal-primary',
      bgColor: 'bg-terminal-primary/10'
    },
    {
      id: 'card',
      label: sc.card,
      amount: formatLocalAmount(routes.card.totalLocal, routes.card.displayCurrency),
      Icon: CreditCard,
      color: 'text-violet-400',
      bgColor: 'bg-violet-400/10'
    },
    {
      id: 'wire',
      label: sc.wire,
      amount: `USD ${routes.wire.totalUsd.toFixed(2)}`,
      Icon: Building2,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10'
    }
  ];

  return (
    <div className="space-y-[2mm]">
      <p className="text-xs font-semibold uppercase tracking-widest text-terminal-muted">
        {sc.selectMethod}
      </p>

      <div className="payment-method-list">
        {methods.map(({ id, label, amount, Icon, color, bgColor }) => {
          const isActive = selected === id;
          return (
            <button
              key={id}
              type="button"
              disabled={loading}
              onClick={() => onSelect(id)}
              className={[
                'payment-method-btn group relative border',
                isActive
                  ? 'border-terminal-primary bg-terminal-primary/10 shadow-md shadow-terminal-primary/10 ring-1 ring-terminal-primary/30'
                  : 'border-terminal-border bg-terminal-card hover:border-terminal-primary/40 hover:bg-terminal-bg',
                loading ? 'cursor-wait opacity-60' : 'cursor-pointer'
              ].join(' ')}
            >
              {isActive && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-terminal-primary shadow-lg shadow-terminal-primary/50" />
              )}

              <div className="payment-method-btn__row">
                <div
                  className={`shrink-0 rounded-lg p-2 ${
                    isActive ? 'bg-terminal-primary/20 text-terminal-primary' : `${bgColor} ${color}`
                  }`}
                >
                  <Icon size={20} />
                </div>
                <span
                  className={`payment-method-btn__label ${
                    isActive ? 'text-terminal-primary' : 'text-terminal-text'
                  }`}
                >
                  {label}
                </span>
              </div>

              <span className="payment-method-btn__amount">{amount}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
