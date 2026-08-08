'use client';

import { CreditCard } from 'lucide-react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { SimplifiedCardMethod } from '../../../lib/payments/checkoutBestRouteService';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';
import { MacroClickPayButton } from '../gateway/MacroClickPayButton';

type Props = {
  card: SimplifiedCardMethod;
  referenceId: string;
  country: string;
  amountUsd: number;
  onFunded?: () => void;
  onError?: (message: string) => void;
};

/**
 * Debit and credit card through Macro's hosted button.
 *
 * It replaced an embedded Transak widget. The widget looked nicer — the form
 * lived inside the page and reported completion by postMessage — but it was a
 * second provider to trust with card data, on top of the bank the operation
 * already runs on. Macro collects the card, settles to the treasury and reports
 * back through the same webhook the transfer lane uses, so one integration
 * covers both.
 *
 * The trade-off is that the payer leaves the page for the bank's form and comes
 * back, so completion is confirmed server-side by the webhook rather than by a
 * message from an iframe.
 */
export function CardPaymentPanel({ card, referenceId, amountUsd, onError }: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;

  if (!card.configured) {
    return (
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-5">
        <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-violet-400/10 p-2.5 text-violet-400">
          <CreditCard size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{sc.cardTitle}</h3>
          <p className="mt-0.5 text-xs text-terminal-muted">Visa · Mastercard · Débito</p>
        </div>
      </div>

      <div className="rounded-xl border border-terminal-border bg-terminal-bg px-4 py-3.5">
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

      <PaymentFeeBreakdown
        amountUsd={amountUsd}
        totalUsd={card.totalUsd}
        gatewayChargedBy="Macro"
        fxChargedBy="Macro"
      />

      <div className="space-y-2">
        <p className="text-center text-[11px] text-terminal-muted">
          El monto ya está precargado. Vas a completar los datos de la tarjeta en el formulario
          seguro del Banco Macro y volvés acá.
        </p>
        <MacroClickPayButton
          referenceId={referenceId}
          referenceKind="cart"
          amountUsd={card.totalUsd}
          currency={card.displayCurrency === 'ARS' ? 'ARS' : 'USD'}
          onError={onError}
        />
      </div>
    </section>
  );
}
