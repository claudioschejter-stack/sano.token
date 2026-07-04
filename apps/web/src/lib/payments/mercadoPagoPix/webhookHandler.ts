import { getMercadoPagoPixPaymentApi } from './client';
import { findMercadoPagoPixPaymentByMpPaymentId, updateMercadoPagoPixPaymentFromApi } from './repository';
import { dispatchApprovedLocalWalletPayment } from '../localWalletWebhookSettlement';

const PAID_PIX_STATUSES = new Set(['approved']);

/**
 * Handles Mercado Pago's regular "payment" webhook when the underlying payment method
 * is Pix, mirroring mercadoPagoQr/webhookHandler.ts for the Orders API. Safe no-op for
 * any mpPaymentId that isn't a tracked MercadoPagoPixPayment (e.g. card payments).
 */
export async function handleMercadoPagoPixWebhookIfTracked(mpPaymentId: string) {
  const local = await findMercadoPagoPixPaymentByMpPaymentId(mpPaymentId);
  if (!local) {
    return { ok: true, ignored: 'pix_payment_not_tracked' as const };
  }

  const apiPayment = await getMercadoPagoPixPaymentApi(mpPaymentId);
  const updated = await updateMercadoPagoPixPaymentFromApi(local.id, apiPayment);

  if (PAID_PIX_STATUSES.has(updated.status)) {
    await dispatchApprovedLocalWalletPayment({
      externalReference: updated.externalReference,
      provider: 'mercado_pago_pix',
      providerPaymentId: updated.mpPaymentId,
      amountUsd: null,
      payload: {
        mpPaymentId: updated.mpPaymentId,
        externalReference: updated.externalReference,
        amountBrl: Number(updated.amountBrl),
        status: updated.status
      }
    });
  }

  return {
    ok: true,
    paymentId: updated.id,
    mpPaymentId: updated.mpPaymentId,
    status: updated.status
  };
}
