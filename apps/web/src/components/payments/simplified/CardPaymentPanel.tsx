'use client';

import { CreditCard, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
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
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-5">
        <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
      </section>
    );
  }

  if (done) {
    return (
      <section className="rounded-xl border border-terminal-success/30 bg-terminal-success/10 p-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-terminal-success" />
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
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-violet-400/10 p-2.5 text-violet-400">
          <CreditCard size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{sc.cardTitle}</h3>
          <p className="mt-0.5 text-xs text-terminal-muted">
            Pagá con tu tarjeta de débito o crédito de forma segura.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-terminal-border bg-terminal-bg px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-terminal-muted">
              Total a pagar
            </p>
            <p className="mt-1 text-2xl font-bold text-terminal-text">
              {card.displayCurrency === 'USD'
                ? `USD ${card.totalUsd.toFixed(2)}`
                : new Intl.NumberFormat('es-AR', {
                    style: 'currency',
                    currency: card.displayCurrency
                  }).format(card.totalLocal)}
            </p>
            <p className="mt-0.5 text-[11px] text-terminal-muted">
              Recibirás {card.totalUsd.toFixed(2)} USDC en tu cuenta
            </p>
          </div>
          <ShieldCheck className="h-8 w-8 text-terminal-success/60" />
        </div>
      </div>

      <PaymentFeeBreakdown
        amountUsd={amountUsd}
        totalUsd={card.totalUsd}
        feeBps={card.feeBps}
        providerLabel="Stripe / MoonPay"
      />

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-900/20 px-3 py-2.5">
          <p className="text-xs font-medium text-red-400">{error}</p>
        </div>
      )}

      <button
        type="button"
        disabled={!privyReady || busy}
        onClick={() => void handlePay()}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-violet-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-violet-900/30 transition-all hover:bg-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando pago…
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Pagar {card.totalUsd.toFixed(2)} USD con tarjeta
          </>
        )}
      </button>

      {!privyReady && (
        <p className="text-center text-[10px] text-terminal-warning">
          Configurá NEXT_PUBLIC_PRIVY_APP_ID para activar pagos con tarjeta.
        </p>
      )}
    </section>
  );
}
