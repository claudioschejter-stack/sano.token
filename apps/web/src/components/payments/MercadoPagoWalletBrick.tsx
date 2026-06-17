'use client';

import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useEffect, useMemo, useState } from 'react';
import {
  formatMercadoPagoBrickError,
  type MercadoPagoEmbeddedSession
} from '../../lib/payments/mercadoPagoEmbeddedService';

let mercadoPagoInitializedKey: string | null = null;

type MercadoPagoWalletBrickProps = {
  session: MercadoPagoEmbeddedSession;
  externalReference: string;
  amountUsd: number;
  batchId?: string | null;
  onApproved?: () => void;
  onPending?: (paymentId: string) => void;
  onError?: (message: string) => void;
};

function ensureMercadoPagoInit(publicKey: string) {
  if (mercadoPagoInitializedKey === publicKey) {
    return;
  }
  initMercadoPago(publicKey, { locale: 'es-AR' });
  mercadoPagoInitializedKey = publicKey;
}

export function MercadoPagoWalletBrick({
  session,
  externalReference,
  amountUsd,
  batchId,
  onApproved,
  onPending,
  onError
}: MercadoPagoWalletBrickProps) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    ensureMercadoPagoInit(session.publicKey);
  }, [session.publicKey]);

  const paymentMethods = useMemo(
    () => ({
      mercadoPago: 'all' as const
    }),
    []
  );

  return (
    <div className="space-y-3 rounded-lg border border-terminal-border bg-terminal-bg p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-terminal-text">Mercado Pago</p>
        <p className="text-xs text-terminal-muted">
          Pagá con el saldo de tu cuenta Mercado Pago. Monto:{' '}
          <span className="font-mono tabular-nums">
            {session.amount.toLocaleString('es-AR', {
              style: 'currency',
              currency: session.currency
            })}
          </span>
        </p>
      </div>

      <Payment
        locale="es-AR"
        initialization={{
          amount: session.amount,
          preferenceId: session.preferenceId
        }}
        customization={{
          paymentMethods: paymentMethods as never,
          visual: {
            defaultPaymentOption: {
              walletForm: true
            }
          }
        }}
        onSubmit={async ({ formData, selectedPaymentMethod, paymentType }) => {
          const method = selectedPaymentMethod ?? paymentType;
          if (method === 'wallet_purchase') {
            // Wallet balance is charged via preferenceId redirect, not our Payments API.
            return;
          }

          setSubmitting(true);
          try {
            const response = await fetch('/api/payments/mercadopago/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                formData,
                externalReference,
                amountUsd,
                batchId: batchId ?? undefined
              })
            });
            const data = (await response.json()) as {
              error?: string;
              approved?: boolean;
              pending?: boolean;
              paymentId?: string;
            };

            if (!response.ok) {
              throw new Error(data.error ?? 'PAYMENT_PROCESS_FAILED');
            }

            if (data.approved) {
              onApproved?.();
              return;
            }

            if (data.pending && data.paymentId) {
              onPending?.(data.paymentId);
              return;
            }

            onError?.(data.error ?? 'PAYMENT_NOT_APPROVED');
          } catch (error) {
            onError?.(error instanceof Error ? error.message : 'PAYMENT_PROCESS_FAILED');
          } finally {
            setSubmitting(false);
          }
        }}
        onError={(error) => {
          console.error('[MercadoPagoWalletBrick]', error);
          onError?.(formatMercadoPagoBrickError(error));
        }}
      />

      {submitting ? (
        <p className="text-xs text-terminal-muted">Procesando pago con Mercado Pago…</p>
      ) : null}
    </div>
  );
}
