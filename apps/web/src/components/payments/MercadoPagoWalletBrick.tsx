'use client';

import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useEffect, useMemo, useState } from 'react';
import type { MercadoPagoEmbeddedSession } from '../../lib/payments/mercadoPagoEmbeddedService';

let mercadoPagoInitialized = false;

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
  if (mercadoPagoInitialized) {
    return;
  }
  initMercadoPago(publicKey, { locale: 'es-AR' });
  mercadoPagoInitialized = true;
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
    () =>
      session.walletOnly
        ? {
            creditCard: 'none' as const,
            debitCard: 'none' as const,
            ticket: 'none' as const,
            bankTransfer: 'none' as const,
            walletPurchase: 'all' as const
          }
        : {
            creditCard: 'none' as const,
            debitCard: 'none' as const,
            ticket: 'all' as const,
            bankTransfer: 'all' as const,
            atm: 'all' as const,
            walletPurchase: 'all' as const
          },
    [session.walletOnly]
  );

  return (
    <div className="space-y-3 rounded-lg border border-terminal-border bg-terminal-bg p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-terminal-text">Saldo Mercado Pago</p>
        <p className="text-xs text-terminal-muted">
          Pagá con tu cuenta MP sin salir de Sanova. Monto:{' '}
          <span className="font-mono tabular-nums">
            {session.amount.toLocaleString('es-AR', {
              style: 'currency',
              currency: session.currency
            })}
          </span>
        </p>
      </div>

      <Payment
        initialization={{
          amount: session.amount,
          preferenceId: session.preferenceId
        }}
        customization={{
          paymentMethods: paymentMethods as never
        }}
        onSubmit={async ({ formData }) => {
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
          onError?.(typeof error === 'string' ? error : 'MERCADOPAGO_BRICK_ERROR');
        }}
      />

      {submitting ? (
        <p className="text-xs text-terminal-muted">Procesando pago con Mercado Pago…</p>
      ) : null}
    </div>
  );
}
