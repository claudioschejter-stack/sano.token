'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { CheckoutBestRoutes } from '../../../lib/payments/checkoutBestRouteService';
import type { SimplifiedMethod } from './SimplifiedMethodSelector';
import { SimplifiedMethodSelector } from './SimplifiedMethodSelector';
import { FiatWalletPanel } from './FiatWalletPanel';
import { CryptoWalletPanel } from './CryptoWalletPanel';
import { CardPaymentPanel } from './CardPaymentPanel';
import { WireTransferPanel } from './WireTransferPanel';

export type SimplifiedCheckoutProps = {
  amountUsd: number;
  referenceId: string;
  investorName?: string;
  /** ISO-2 country code (or from IP detection) */
  country?: string;
  className?: string;
  onFunded?: () => void;
  onError?: (message: string) => void;
};

async function fetchRoutes(params: {
  amountUsd: number;
  referenceId: string;
  country: string;
  investorName?: string;
}): Promise<CheckoutBestRoutes> {
  const res = await fetch('/api/payments/checkout-methods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) throw new Error(`checkout-methods error: ${res.status}`);
  return res.json() as Promise<CheckoutBestRoutes>;
}

export function SimplifiedCheckout({
  amountUsd,
  referenceId,
  investorName,
  country = 'US',
  className = '',
  onFunded,
  onError
}: SimplifiedCheckoutProps) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;

  const [routes, setRoutes] = useState<CheckoutBestRoutes | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<SimplifiedMethod | null>(null);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await fetchRoutes({ amountUsd, referenceId, country, investorName });
      setRoutes(data);
      // Default to fiat_wallet
      if (!selectedMethod) setSelectedMethod('fiat_wallet');
    } catch (err) {
      const msg = err instanceof Error ? err.message : sc.errorRoutes;
      setFetchError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountUsd, referenceId, country, investorName]);

  useEffect(() => {
    void loadRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 py-8 ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-terminal-primary" />
        <span className="text-sm text-terminal-muted">{sc.loadingRoutes}</span>
      </div>
    );
  }

  if (fetchError || !routes) {
    return (
      <div className={`space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 ${className}`}>
        <p className="text-sm text-red-700">{fetchError ?? sc.errorRoutes}</p>
        <button
          type="button"
          onClick={() => void loadRoutes()}
          className="rounded-lg bg-terminal-primary px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
        >
          {sc.retryRoutes}
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <SimplifiedMethodSelector
        routes={routes}
        selected={selectedMethod}
        onSelect={setSelectedMethod}
      />

      {selectedMethod === 'fiat_wallet' && (
        <FiatWalletPanel
          fiatWallet={routes.fiatWallet}
          referenceId={referenceId}
          country={routes.country}
          onFunded={onFunded}
        />
      )}

      {selectedMethod === 'crypto_wallet' && (
        <CryptoWalletPanel
          cryptoWallet={routes.cryptoWallet}
          treasuryAddress={routes.treasuryAddress}
          country={routes.country}
        />
      )}

      {selectedMethod === 'card' && (
        <CardPaymentPanel
          card={routes.card}
          referenceId={referenceId}
          onFunded={onFunded}
        />
      )}

      {selectedMethod === 'wire' && (
        <WireTransferPanel wire={routes.wire} />
      )}
    </div>
  );
}
