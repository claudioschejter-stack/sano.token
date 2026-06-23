'use client';

import { useTranslation } from '../../../i18n/LocaleProvider';
import type { SimplifiedCardMethod } from '../../../lib/payments/checkoutBestRouteService';

type Props = {
  card: SimplifiedCardMethod;
  referenceId: string;
  onFunded?: () => void;
};

export function CardPaymentPanel({ card, onFunded: _ }: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;

  if (!card.configured) {
    return (
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
        <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
      </section>
    );
  }

  // --- Transak card widget ---
  if (card.provider === 'transak' && card.widgetUrl) {
    return (
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-terminal-text">{sc.cardTitle}</h3>
        <p className="mb-3 text-xs text-terminal-muted">{sc.cardTransakHint}</p>
        <iframe
          src={card.widgetUrl}
          allow="camera; microphone; payment"
          className="h-[600px] w-full rounded-lg border border-terminal-border"
          title="Transak Payment Widget"
        />
      </section>
    );
  }

  // --- Mercado Pago Embedded Brick ---
  if (card.provider === 'mercado_pago_embedded') {
    return (
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-terminal-text">{sc.cardTitle}</h3>
        <p className="mb-3 text-xs text-terminal-muted">{sc.cardMpHint}</p>
        {/* MP Embedded Brick mount point — initialization is handled by CartCheckoutView
            which already has the MP Brick logic wired via CheckoutPaymentLaneSelector.
            Showing a placeholder here until the brick renders. */}
        <div
          id="simplified-mp-card-brick"
          className="min-h-[300px] rounded-lg border border-terminal-border bg-white"
        />
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-terminal-border bg-terminal-card p-4">
      <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
    </section>
  );
}
