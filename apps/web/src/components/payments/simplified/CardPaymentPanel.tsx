'use client';

import { CheckCircle2, CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../i18n/LocaleProvider';
import type { SimplifiedCardMethod } from '../../../lib/payments/checkoutBestRouteService';
import { PaymentFeeBreakdown } from './PaymentFeeBreakdown';

type Props = {
  card: SimplifiedCardMethod;
  referenceId: string;
  country: string;
  amountUsd: number;
  onFunded?: () => void;
  onError?: (message: string) => void;
};

/** Transak widget postMessage event ids — see https://docs.transak.com/integration/web/iframe */
type TransakMessage = {
  event_id?: string;
  data?: Record<string, unknown>;
};

export function CardPaymentPanel({ card, amountUsd, onFunded, onError }: Props) {
  const t = useTranslation();
  const sc = t.simplifiedCheckout;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onFundedRef = useRef(onFunded);
  const onErrorRef = useRef(onError);
  onFundedRef.current = onFunded;
  onErrorRef.current = onError;

  const [status, setStatus] = useState<'loading' | 'ready' | 'confirmed' | 'failed'>('loading');

  const transakUrl = card.widgetUrl;

  // Listen for Transak's widget lifecycle events so payment completion is detected
  // automatically — the user never has to leave the page or click "I've paid".
  useEffect(() => {
    if (!transakUrl) return;

    const handleMessage = (event: MessageEvent<TransakMessage>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const eventId = event.data?.event_id;
      if (eventId === 'TRANSAK_WIDGET_OPEN') {
        setStatus('ready');
      } else if (eventId === 'TRANSAK_ORDER_SUCCESSFUL') {
        setStatus('confirmed');
        onFundedRef.current?.();
      } else if (eventId === 'TRANSAK_ORDER_FAILED') {
        setStatus('failed');
        onErrorRef.current?.('El pago con tarjeta no pudo procesarse. Intentá nuevamente.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [transakUrl]);

  if (!card.configured || !transakUrl) {
    return (
      <section className="rounded-xl border border-terminal-border bg-terminal-card p-5">
        <p className="text-sm text-terminal-muted">{sc.notConfigured}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-terminal-border bg-terminal-card p-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-violet-400/10 p-2.5 text-violet-400">
          <CreditCard size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-terminal-text">{sc.cardTitle}</h3>
          <p className="mt-0.5 text-xs text-terminal-muted">
            Visa · Mastercard · Google Pay · Apple Pay · PayPal
          </p>
        </div>
      </div>

      {/* Amount */}
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

      {/* Fee breakdown */}
      <PaymentFeeBreakdown amountUsd={amountUsd} totalUsd={card.totalUsd} gatewayChargedBy="Transak" fxChargedBy="Transak" />

      {status === 'confirmed' ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-terminal-success/40 bg-terminal-success/10 px-4 py-6 text-center">
          <CheckCircle2 size={28} className="text-terminal-success" />
          <p className="text-sm font-bold text-terminal-success">¡Pago con tarjeta exitoso!</p>
          <p className="text-xs text-terminal-muted">Estamos acreditando tu USDC en Base.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-center text-[11px] text-terminal-muted">
            El monto ya está precargado — completá tus datos o pagá con Google Pay, Apple Pay o PayPal dentro del formulario.
          </p>
          <div className="relative overflow-hidden rounded-xl border border-terminal-border bg-white">
            {status === 'loading' && (
              <div className="flex h-[620px] w-full items-center justify-center gap-2 text-sm text-terminal-muted">
                <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                Cargando formulario de pago…
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={transakUrl}
              allow="camera; microphone; payment; clipboard-write"
              referrerPolicy="strict-origin-when-cross-origin"
              className={`w-full rounded-xl border-0 ${status === 'loading' ? 'hidden' : 'block h-[620px]'}`}
              title="Transak — pago con tarjeta"
            />
          </div>
          <a
            href={transakUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-terminal-primary hover:underline"
          >
            ¿Problemas para ver el formulario? Abrilo en una pestaña nueva
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </section>
  );
}
