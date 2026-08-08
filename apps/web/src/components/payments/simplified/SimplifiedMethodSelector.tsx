'use client';

import { Building2, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { CheckoutBestRoutes } from '../../../lib/payments/checkoutBestRouteService';

export type SimplifiedMethod = 'fiat_wallet' | 'crypto_wallet' | 'card' | 'wire' | 'ripio';

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

/**
 * Which provider serves the virtual wallet lane, and at what price.
 *
 * Ripio and the Transak wallet flow are the same thing to an investor — pay
 * from the wallet app on your phone — and listing them separately made the menu
 * show five options where there are four, asking the investor to choose between
 * two names they have no way to compare. Whichever is configured and cheaper
 * wins; the label stays the same either way.
 */
function virtualWalletLane(routes: CheckoutBestRoutes): {
  id: SimplifiedMethod;
  configured: boolean;
  totalUsd: number;
  totalLocal: number;
  displayCurrency: string;
} {
  const candidates = [
    {
      id: 'ripio' as const,
      configured: routes.ripio.configured,
      totalUsd: routes.ripio.totalUsd,
      totalLocal: routes.ripio.totalLocal,
      displayCurrency: routes.ripio.displayCurrency
    },
    {
      id: 'fiat_wallet' as const,
      configured: routes.fiatWallet.configured,
      totalUsd: routes.fiatWallet.totalUsd,
      totalLocal: routes.fiatWallet.totalLocal,
      displayCurrency: routes.fiatWallet.displayCurrency
    }
  ];

  const usable = candidates.filter((row) => row.configured);
  if (usable.length === 0) {
    return { ...candidates[1], configured: false };
  }
  return usable.reduce((best, row) => (row.totalUsd < best.totalUsd ? row : best));
}

function isMethodConfigured(routes: CheckoutBestRoutes, id: SimplifiedMethod): boolean {
  switch (id) {
    case 'fiat_wallet':
      return routes.fiatWallet.configured;
    case 'crypto_wallet':
      return routes.cryptoWallet.configured;
    case 'card':
      return routes.card.configured;
    case 'wire':
      return routes.wire.configured;
    case 'ripio':
      return routes.ripio.configured;
  }
}

function methodTotalUsd(routes: CheckoutBestRoutes, id: SimplifiedMethod): number {
  switch (id) {
    case 'fiat_wallet':
      return routes.fiatWallet.totalUsd;
    case 'crypto_wallet':
      return routes.cryptoWallet.totalUsd;
    case 'card':
      return routes.card.totalUsd;
    case 'wire':
      return routes.wire.totalUsd;
    case 'ripio':
      return routes.ripio.totalUsd;
  }
}

export function getCheapestConfiguredMethod(routes: CheckoutBestRoutes): SimplifiedMethod | null {
  const ids: SimplifiedMethod[] = ['crypto_wallet', 'fiat_wallet', 'ripio', 'card', 'wire'];
  const available = ids.filter((id) => isMethodConfigured(routes, id));
  if (available.length === 0) return null;
  return available.reduce((best, id) =>
    methodTotalUsd(routes, id) < methodTotalUsd(routes, best) ? id : best
  );
}

export function SimplifiedMethodSelector({ routes, selected, onSelect, loading }: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;

  /**
   * Four ways to pay, the same four everywhere.
   *
   * Not four providers: four things an investor recognises. Which company
   * actually collects the money changes by country, and that is precisely what
   * they should never have to think about.
   */
  const methods = useMemo(() => {
    const virtual = virtualWalletLane(routes);

    const all: {
      id: SimplifiedMethod;
      label: string;
      amount: string;
      totalUsd: number;
      Icon: typeof CreditCard;
      color: string;
      bgColor: string;
      configured: boolean;
    }[] = [
      {
        id: 'crypto_wallet',
        label: sc.cryptoWallet,
        amount: `${Number(routes.cryptoWallet.totalUsd.toFixed(6))} USDC`,
        totalUsd: routes.cryptoWallet.totalUsd,
        Icon: Wallet,
        color: 'text-terminal-primary',
        bgColor: 'bg-terminal-primary/10',
        configured: routes.cryptoWallet.configured
      },
      {
        id: virtual.id,
        label: sc.virtualWallet,
        amount: formatLocalAmount(virtual.totalLocal, virtual.displayCurrency),
        totalUsd: virtual.totalUsd,
        Icon: Smartphone,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-400/10',
        configured: virtual.configured
      },
      {
        id: 'card',
        label: sc.card,
        amount: formatLocalAmount(routes.card.totalLocal, routes.card.displayCurrency),
        totalUsd: routes.card.totalUsd,
        Icon: CreditCard,
        color: 'text-violet-400',
        bgColor: 'bg-violet-400/10',
        configured: routes.card.configured
      },
      {
        id: 'wire',
        label: sc.wire,
        amount: formatLocalAmount(routes.wire.totalLocal, routes.wire.displayCurrency),
        totalUsd: routes.wire.totalUsd,
        Icon: Building2,
        color: 'text-amber-400',
        bgColor: 'bg-amber-400/10',
        configured: routes.wire.configured
      }
    ];

    return all
      .filter((method) => method.configured)
      .sort((a, b) => a.totalUsd - b.totalUsd);
  }, [routes, sc.card, sc.cryptoWallet, sc.virtualWallet, sc.wire]);

  const cheapestId = methods[0]?.id ?? null;

  return (
    <div style={{ marginBlock: '2mm' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {methods.length === 0 ? (
          <p className="rounded-xl border border-terminal-border bg-terminal-card px-4 py-3 text-sm text-terminal-muted">
            {sc.notConfigured}
          </p>
        ) : null}

        {methods.map(({ id, label, amount, Icon, color, bgColor }) => {
          const isActive = selected === id;
          const isCheapest = id === cheapestId;
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
              {isCheapest ? (
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    borderRadius: 999,
                    background: 'rgba(16,185,129,0.18)',
                    color: '#34D399',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    letterSpacing: '0.02em',
                  }}
                >
                  {sc.cheapestBadge}
                </span>
              ) : isActive ? (
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
              ) : null}

              <div
                className={isActive ? 'bg-terminal-primary/20 text-terminal-primary' : `${bgColor} ${color}`}
                style={{ flexShrink: 0, borderRadius: 8, padding: 8 }}
              >
                <Icon size={20} />
              </div>

              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: '1rem',
                  fontWeight: 600,
                  lineHeight: 1.35,
                  color: isActive ? '#3B82F6' : '#E2E8F0',
                  paddingRight: isCheapest ? 72 : 0,
                }}
              >
                {label}
              </span>

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
