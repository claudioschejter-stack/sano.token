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
    <div style={{ marginBlock: '2mm' }}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-terminal-muted">
        {sc.selectMethod}
      </p>

      {/* Full-width stacked buttons — all screen sizes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {methods.map(({ id, label, amount, Icon, color, bgColor }) => {
          const isActive = selected === id;
          return (
            <button
              key={id}
              type="button"
              disabled={loading}
              onClick={() => onSelect(id)}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%',
                padding: '14px 16px',
                gap: '12px',
                borderRadius: '12px',
                border: isActive
                  ? '1px solid #3B82F6'
                  : '1px solid #1F2937',
                background: isActive ? 'rgba(59,130,246,0.10)' : '#111827',
                boxShadow: isActive ? '0 2px 12px rgba(59,130,246,0.10)' : 'none',
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.6 : 1,
                textAlign: 'left',
                position: 'relative',
              }}
            >
              {isActive && (
                <span style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#3B82F6',
                  boxShadow: '0 0 8px rgba(59,130,246,0.5)',
                }} />
              )}

              {/* Icon */}
              <div
                className={isActive ? 'bg-terminal-primary/20 text-terminal-primary' : `${bgColor} ${color}`}
                style={{ flexShrink: 0, borderRadius: 8, padding: 8 }}
              >
                <Icon size={20} />
              </div>

              {/* Label */}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: '1rem',
                  fontWeight: 600,
                  lineHeight: 1.35,
                  color: isActive ? '#3B82F6' : '#E2E8F0',
                }}
              >
                {label}
              </span>

              {/* Amount — right-aligned */}
              <span
                style={{
                  flexShrink: 0,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#3B82F6',
                  textAlign: 'right',
                  marginLeft: 'auto',
                }}
              >
                {amount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
