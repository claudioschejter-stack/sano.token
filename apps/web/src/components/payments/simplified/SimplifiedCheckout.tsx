'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { CheckoutBestRoutes } from '../../../lib/payments/checkoutBestRouteService';
import { useCheckoutSettlementStatus } from '../../../hooks/useCheckoutSettlementStatus';
import type { SimplifiedMethod } from './SimplifiedMethodSelector';
import { getCheapestConfiguredMethod, SimplifiedMethodSelector } from './SimplifiedMethodSelector';
import { FiatWalletPanel } from './FiatWalletPanel';
import { CryptoWalletPanel } from './CryptoWalletPanel';
import { CardPaymentPanel } from './CardPaymentPanel';
import { WireTransferPanel } from './WireTransferPanel';

export type EnsureCheckoutReference = (
  method: 'USDC_ONCHAIN' | 'LOCAL_RAIL',
  rail?: string
) => Promise<{ referenceId: string; payToAddress: string | null } | null>;

export type SimplifiedCheckoutProps = {
  amountUsd: number;
  referenceId: string;
  investorName?: string;
  country?: string;
  mode?: 'deposit' | 'purchase';
  ensureReference?: EnsureCheckoutReference;
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

function settlementPhaseLabel(
  phase: string,
  labels: {
    awaiting_payment: string;
    fiat_paid: string;
    awaiting_usdc: string;
    confirmed: string;
    rwa_delivered: string;
    failed: string;
  }
): string | null {
  if (phase === 'idle') return null;
  return labels[phase as keyof typeof labels] ?? null;
}

export function SimplifiedCheckout({
  amountUsd,
  referenceId,
  investorName,
  country = 'US',
  mode = 'deposit',
  ensureReference,
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
  const [activeReferenceId, setActiveReferenceId] = useState<string | null>(referenceId || null);
  const [paymentDetected, setPaymentDetected] = useState(false);
  const completedRef = useRef(false);

  const { phase, isComplete } = useCheckoutSettlementStatus({
    referenceId: paymentDetected ? activeReferenceId : null,
    mode,
    enabled: paymentDetected
  });

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await fetchRoutes({ amountUsd, referenceId, country, investorName });
      setRoutes(data);
      setSelectedMethod((current) => current ?? getCheapestConfiguredMethod(data));
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

  useEffect(() => {
    if (!isComplete || completedRef.current) return;
    completedRef.current = true;
    onFunded?.();
  }, [isComplete, onFunded]);

  const handlePaymentSignal = useCallback((ref?: string | null) => {
    if (ref) setActiveReferenceId(ref);
    setPaymentDetected(true);
  }, []);

  const wrapEnsureReference = useCallback<EnsureCheckoutReference>(
    async (method, rail) => {
      if (!ensureReference) return null;
      const result = await ensureReference(method, rail);
      if (result?.referenceId) {
        setActiveReferenceId(result.referenceId);
      }
      return result;
    },
    [ensureReference]
  );

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

  const phaseLabel = settlementPhaseLabel(phase, {
    awaiting_payment: sc.settlementAwaitingPayment,
    fiat_paid: sc.settlementFiatPaid,
    awaiting_usdc: sc.settlementAwaitingUsdc,
    confirmed: sc.settlementConfirmed,
    rwa_delivered: sc.settlementRwaDelivered,
    failed: sc.settlementFailed
  });

  return (
    <div className={`space-y-4 ${className}`}>
      <SimplifiedMethodSelector
        routes={routes}
        selected={selectedMethod}
        onSelect={setSelectedMethod}
      />

      {paymentDetected && phaseLabel ? (
        <div className="rounded-xl border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-3 text-sm text-terminal-text">
          <div className="flex items-center gap-2">
            {!isComplete ? <Loader2 className="h-4 w-4 animate-spin text-terminal-primary" /> : null}
            <span>{phaseLabel}</span>
          </div>
        </div>
      ) : null}

      {selectedMethod === 'fiat_wallet' && (
        <FiatWalletPanel
          fiatWallet={routes.fiatWallet}
          referenceId={activeReferenceId ?? referenceId}
          country={routes.country}
          onFunded={() => handlePaymentSignal(activeReferenceId)}
          amountUsd={amountUsd}
          ensureReference={wrapEnsureReference}
        />
      )}

      {selectedMethod === 'crypto_wallet' && (
        <CryptoWalletPanel
          cryptoWallet={routes.cryptoWallet}
          treasuryAddress={routes.treasuryAddress}
          country={routes.country}
          amountUsd={amountUsd}
          mode={mode}
          onFunded={() => handlePaymentSignal(activeReferenceId)}
          ensureReference={wrapEnsureReference}
        />
      )}

      {selectedMethod === 'card' && (
        <CardPaymentPanel
          card={routes.card}
          referenceId={activeReferenceId ?? referenceId}
          country={routes.country}
          onFunded={() => handlePaymentSignal(activeReferenceId ?? referenceId)}
          onError={onError}
          amountUsd={amountUsd}
        />
      )}

      {selectedMethod === 'wire' && (
        <WireTransferPanel
          wire={routes.wire}
          amountUsd={amountUsd}
          referenceId={activeReferenceId ?? referenceId}
          investorName={investorName}
          onPending={() => handlePaymentSignal(activeReferenceId ?? referenceId)}
        />
      )}
    </div>
  );
}
