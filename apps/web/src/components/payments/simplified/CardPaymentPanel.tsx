'use client';

import { CreditCard, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { SimplifiedCardMethod } from '../../../lib/payments/checkoutBestRouteService';
import { useGlobalRetailOnRamp } from '../../../hooks/useGlobalRetailOnRamp';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';

type Props = {
  card: SimplifiedCardMethod;
  referenceId: string;
  country: string;
  amountUsd: number;
  onFunded?: () => void;
};

export function CardPaymentPanel({ card, country, amountUsd, onFunded }: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const { startOnRamp, privyReady } = useGlobalRetailOnRamp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!card.configured) {
    return (
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
        <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
      </section>
    );
  }

  if (done) {
    return (
      <section className="rounded-xl border border-terminal-success/30 bg-terminal-success/10 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-terminal-success" />
          <div>
            <p className="text-sm font-semibold text-terminal-success">Pago procesado correctamente</p>
            <p className="mt-1 text-xs text-terminal-muted">
              El USDC fue acreditado. Confirmando la operación…
            </p>
          </div>
        </div>
      </section>
    );
  }

  const handlePay = async () => {
    setBusy(true);
    setError(null);
    try {
      await startOnRamp({
        amountUsd: card.totalUsd,
        countryCode: country,
        preferredProvider: 'stripe'
      });
      setDone(true);
      onFunded?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PRIVY_FUND_FAILED';
      if (!message.toLowerCase().includes('closed') && !message.toLowerCase().includes('cancel')) {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-4">
      <div>
        <h3 className="text-sm font-semibold text-terminal-text">{sc.cardTitle}</h3>
        <p className="mt-1 text-xs text-terminal-muted">{sc.cardPrivyHint}</p>
      </div>

      <div className="rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-terminal-muted">
          Proveedores disponibles
        </p>
        <div className="flex flex-wrap gap-2">
          {['Stripe', 'MoonPay', 'Coinbase Pay'].map((p) => (
            <span
              key={p}
              className="rounded-full border border-terminal-border bg-white px-2.5 py-0.5 text-[11px] font-medium text-terminal-text"
            >
              {p}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-terminal-muted">
          Privy selecciona automáticamente el mejor proveedor de tarjeta disponible para tu región.
        </p>
      </div>

      <PaymentFeeBreakdown
        amountUsd={amountUsd}
        totalUsd={card.totalUsd}
        feeBps={card.feeBps}
        providerLabel="Privy / Stripe"
      />

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!privyReady || busy}
        onClick={() => void handlePay()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-terminal-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {busy
          ? 'Procesando pago…'
          : `Pagar ${card.totalUsd.toFixed(2)} USD con tarjeta`}
      </button>

      {!privyReady && (
        <p className="text-center text-[10px] text-terminal-warning">
          Configurá NEXT_PUBLIC_PRIVY_APP_ID para activar pagos con tarjeta.
        </p>
      )}
    </section>
  );
}
