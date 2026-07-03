'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Loader2, QrCode, RefreshCw, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { MercadoPagoQrMode, MercadoPagoQrOrderView } from '../../../lib/payments/mercadoPagoQr/types';

type MpQrInPersonCheckoutProps = {
  configured: boolean;
};

function statusLabel(status: string): string {
  switch (status) {
    case 'created':
      return 'Esperando pago';
    case 'processed':
    case 'paid':
      return 'Pagado';
    case 'canceled':
      return 'Cancelado';
    case 'refunded':
      return 'Reembolsado';
    case 'expired':
      return 'Expirado';
    default:
      return status;
  }
}

function statusClass(status: string): string {
  if (status === 'processed' || status === 'paid') {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (status === 'canceled' || status === 'expired') {
    return 'bg-red-100 text-red-800';
  }
  if (status === 'refunded') {
    return 'bg-amber-100 text-amber-800';
  }
  return 'bg-sky-100 text-sky-800';
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `HTTP_${response.status}`);
  }
  return payload;
}

export function MpQrInPersonCheckout({ configured }: MpQrInPersonCheckoutProps) {
  const [amount, setAmount] = useState('1000');
  const [description, setDescription] = useState('Cobro presencial');
  const [mode, setMode] = useState<MercadoPagoQrMode>('dynamic');
  const [order, setOrder] = useState<MercadoPagoQrOrderView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialRefund, setPartialRefund] = useState('');

  const canCancel = order?.status === 'created';
  const canRefund = order?.status === 'processed' || order?.status === 'paid';

  const pollOrder = useCallback(async (orderId: string) => {
    const response = await fetch(`/api/payments/qr/${encodeURIComponent(orderId)}`);
    const payload = await readJson<{ order: MercadoPagoQrOrderView }>(response);
    setOrder(payload.order);
    return payload.order;
  }, []);

  useEffect(() => {
    if (!order?.orderId || order.status !== 'created') {
      return;
    }

    const timer = window.setInterval(() => {
      void pollOrder(order.orderId).catch(() => undefined);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [order?.orderId, order?.status, pollOrder]);

  const createOrder = async () => {
    setLoading(true);
    setError(null);

    try {
      const parsedAmount = Number(amount.replace(',', '.'));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error('INVALID_AMOUNT');
      }

      const externalReference = `mp-qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const response = await fetch('/api/payments/qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          amount: parsedAmount,
          description,
          external_reference: externalReference,
          mode,
          items: [
            {
              title: description,
              unit_price: parsedAmount,
              quantity: 1,
              unit_measure: 'unit'
            }
          ]
        })
      });

      const payload = await readJson<{ order: MercadoPagoQrOrderView }>(response);
      setOrder(payload.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CREATE_FAILED');
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async () => {
    if (!order) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/payments/qr/${encodeURIComponent(order.orderId)}/cancel`, {
        method: 'POST',
        headers: { 'X-Idempotency-Key': crypto.randomUUID() }
      });
      const payload = await readJson<{ order: MercadoPagoQrOrderView }>(response);
      setOrder(payload.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CANCEL_FAILED');
    } finally {
      setLoading(false);
    }
  };

  const refundOrder = async (partial?: number) => {
    if (!order) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/payments/qr/${encodeURIComponent(order.orderId)}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify(partial !== undefined ? { amount: partial } : {})
      });
      const payload = await readJson<{ order: MercadoPagoQrOrderView }>(response);
      setOrder(payload.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'REFUND_FAILED');
    } finally {
      setLoading(false);
    }
  };

  if (!configured) {
    return (
      <div className="rounded-2xl border border-dashed border-terminal-border p-8 text-center text-sm text-terminal-muted">
        Mercado Pago QR no configurado.
        <br />
        Configurá <code className="text-xs">MP_ACCESS_TOKEN</code> y{' '}
        <code className="text-xs">MP_EXTERNAL_POS_ID</code> en el servidor.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-terminal-border bg-terminal-card overflow-hidden">
      <div className="flex items-center gap-3 bg-gradient-to-r from-[#009EE3] to-[#007EB5] px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
          <QrCode size={20} />
        </div>
        <div>
          <p className="font-bold text-white">Cobro presencial — Mercado Pago QR</p>
          <p className="text-sm text-white/85">Argentina · API Orders /v1/orders</p>
        </div>
        <span className="ml-auto rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
          ARS
        </span>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-terminal-muted">Monto (ARS)</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm"
              placeholder="1500.00"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-terminal-muted">Descripción</label>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-terminal-muted">Modo QR</label>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as MercadoPagoQrMode)}
              className="w-full rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-sm"
            >
              <option value="dynamic">Dinámico (QR EMVCo por cobro)</option>
              <option value="static">Estático (QR fijo del POS)</option>
              <option value="hybrid">Híbrido (estático + dinámico)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => void createOrder()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#009EE3] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Generar QR
          </button>

          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>

        <div className="flex flex-col items-center gap-4">
          {order ? (
            <>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(order.status)}`}>
                {statusLabel(order.status)}
                {order.statusDetail ? ` · ${order.statusDetail}` : ''}
              </span>

              {order.showQr && order.qrData ? (
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                  <QRCodeSVG value={order.qrData} size={220} level="M" includeMargin={false} />
                </div>
              ) : mode === 'static' ? (
                <p className="max-w-xs text-center text-sm text-terminal-muted">
                  Modo estático: el cliente escanea el QR impreso del POS asociado a{' '}
                      <code className="text-xs">MP_EXTERNAL_POS_ID</code>.
                </p>
              ) : null}

              <div className="w-full space-y-1 text-xs text-terminal-muted">
                <p>
                  Order ID: <span className="font-mono text-terminal-text">{order.mpOrderId}</span>
                </p>
                {order.mpPaymentId ? (
                  <p>
                    Payment ID: <span className="font-mono text-terminal-text">{order.mpPaymentId}</span>
                  </p>
                ) : null}
                <p>
                  Referencia: <span className="font-mono text-terminal-text">{order.externalReference}</span>
                </p>
              </div>

              <div className="flex w-full flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void pollOrder(order.orderId)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 rounded-lg border border-terminal-border px-3 py-2 text-xs font-medium"
                >
                  <RefreshCw size={14} />
                  Actualizar estado
                </button>

                {canCancel ? (
                  <button
                    type="button"
                    onClick={() => void cancelOrder()}
                    disabled={loading}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                  >
                    <XCircle size={14} />
                    Cancelar
                  </button>
                ) : null}
              </div>

              {canRefund ? (
                <div className="flex w-full gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={partialRefund}
                    onChange={(event) => setPartialRefund(event.target.value)}
                    placeholder="Monto parcial (opcional)"
                    className="flex-1 rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = partialRefund.trim()
                        ? Number(partialRefund.replace(',', '.'))
                        : undefined;
                      void refundOrder(parsed);
                    }}
                    disabled={loading}
                    className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Reembolsar
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-center text-sm text-terminal-muted">
              Completá monto y descripción, elegí el modo y generá un QR para cobrar en persona.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
