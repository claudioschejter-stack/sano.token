'use client';

import { ChevronLeft, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { CheckoutBestRoutes } from '../../../lib/payments/checkoutBestRouteService';
import { useCheckoutSettlementStatus } from '../../../hooks/useCheckoutSettlementStatus';
import type { SimplifiedMethod } from './SimplifiedMethodSelector';
import { SimplifiedMethodSelector } from './SimplifiedMethodSelector';
import { FiatWalletPanel } from './FiatWalletPanel';
import { CryptoWalletPanel } from './CryptoWalletPanel';
import { CardPaymentPanel } from './CardPaymentPanel';
import { WireTransferPanel } from './WireTransferPanel';
import { RipioCheckoutPanel } from './RipioCheckoutPanel';

export type EnsureCheckoutReferenceOptions = {
  /** Catalog option — use walletconnect_usdc so confirm accepts an external payer. */
  paymentOptionId?: string;
  walletAddress?: string | null;
  /** Skip the in-memory reference cache and create a fresh checkout batch. */
  forceRefresh?: boolean;
};

export type EnsureCheckoutReference = (
  method: 'USDC_ONCHAIN' | 'LOCAL_RAIL' | 'RIPIO',
  rail?: string,
  options?: EnsureCheckoutReferenceOptions
) => Promise<{
  referenceId: string;
  payToAddress: string | null;
  providerCheckoutUrl?: string | null;
} | null>;

export type SimplifiedCheckoutCartItem = {
  projectId: string;
  tokenCount: number;
};

export type SimplifiedPayableInfo = {
  method: SimplifiedMethod | null;
  investmentUsd: number;
  networkFeeUsd: number;
  /** All-in amount the buyer must hold/pay for the selected (or crypto default) path. */
  totalUsd: number;
};

export type SimplifiedCheckoutProps = {
  amountUsd: number;
  referenceId: string;
  investorName?: string;
  country?: string;
  mode?: 'deposit' | 'purchase';
  /** Cart lines for one-tap Sanova pay (create + settle in one request). */
  cartItems?: SimplifiedCheckoutCartItem[];
  ensureReference?: EnsureCheckoutReference;
  className?: string;
  onFunded?: () => void;
  onError?: (message: string) => void;
  /** Notifies parent when route quotes / selected method change the payable total. */
  onPayableChange?: (info: SimplifiedPayableInfo) => void;
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
  cartItems = [],
  ensureReference,
  className = '',
  onFunded,
  onError,
  onPayableChange
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
  const onPayableChangeRef = useRef(onPayableChange);
  onPayableChangeRef.current = onPayableChange;

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
      // Do not auto-open a method — user taps a button to enter that payment submenu.
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
    if (!routes || !onPayableChangeRef.current) return;
    const cryptoTotal = Number(routes.cryptoWallet.totalUsd) || amountUsd;
    const cryptoFee = Number(routes.cryptoWallet.networkFeeUsd) || 0;
    if (!selectedMethod || selectedMethod === 'crypto_wallet') {
      onPayableChangeRef.current({
        method: selectedMethod,
        investmentUsd: amountUsd,
        networkFeeUsd: cryptoFee,
        totalUsd: Math.max(cryptoTotal, amountUsd + cryptoFee, amountUsd)
      });
      return;
    }
    const methodTotal =
      selectedMethod === 'fiat_wallet'
        ? routes.fiatWallet.totalUsd
        : selectedMethod === 'card'
          ? routes.card.totalUsd
          : selectedMethod === 'wire'
            ? routes.wire.totalUsd
            : selectedMethod === 'ripio'
              ? routes.ripio.totalUsd
              : amountUsd;
    onPayableChangeRef.current({
      method: selectedMethod,
      investmentUsd: amountUsd,
      networkFeeUsd: 0,
      totalUsd: Number.isFinite(methodTotal) ? methodTotal : amountUsd
    });
  }, [routes, selectedMethod, amountUsd]);

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
    async (method, rail, options) => {
      if (!ensureReference) return null;
      const result = await ensureReference(method, rail, options);
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
      {!selectedMethod ? (
        <SimplifiedMethodSelector
          routes={routes}
          selected={null}
          onSelect={setSelectedMethod}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setSelectedMethod(null)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-terminal-primary"
          >
            <ChevronLeft size={14} />
            {sc.backToMethods}
          </button>

          {paymentDetected && phaseLabel ? (
            <div className="rounded-xl border border-terminal-primary/30 bg-terminal-primary/10 px-4 py-3 text-sm text-terminal-text">
              <div className="flex items-center gap-2">
                {!isComplete ? <Loader2 className="h-4 w-4 animate-spin text-terminal-primary" /> : null}
                <span>{phaseLabel}</span>
              </div>
            </div>
          ) : null}

          {selectedMethod === 'fiat_wallet' ? (
            <FiatWalletPanel
              fiatWallet={routes.fiatWallet}
              referenceId={activeReferenceId ?? referenceId}
              country={routes.country}
              onFunded={() => handlePaymentSignal(activeReferenceId)}
              amountUsd={amountUsd}
              ensureReference={wrapEnsureReference}
            />
          ) : null}

          {selectedMethod === 'crypto_wallet' ? (
            <CryptoWalletPanel
              cryptoWallet={routes.cryptoWallet}
              treasuryAddress={routes.treasuryAddress}
              country={routes.country}
              amountUsd={amountUsd}
              mode={mode}
              cartItems={cartItems}
              onFunded={() => handlePaymentSignal(activeReferenceId)}
              ensureReference={wrapEnsureReference}
            />
          ) : null}

          {selectedMethod === 'ripio' ? (
            <RipioCheckoutPanel
              amountUsd={amountUsd}
              ensureReference={wrapEnsureReference}
              onFunded={() => handlePaymentSignal(activeReferenceId)}
            />
          ) : null}

          {selectedMethod === 'card' ? (
            <CardPaymentPanel
              card={routes.card}
              referenceId={activeReferenceId ?? referenceId}
              country={routes.country}
              onFunded={() => handlePaymentSignal(activeReferenceId ?? referenceId)}
              onError={onError}
              amountUsd={amountUsd}
            />
          ) : null}

          {selectedMethod === 'wire' ? (
            <WireTransferPanel
              wire={routes.wire}
              amountUsd={amountUsd}
              referenceId={activeReferenceId ?? referenceId}
              country={routes.country}
              investorName={investorName}
              onPending={() => handlePaymentSignal(activeReferenceId ?? referenceId)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
