import { prisma } from '@sanova/database';
import { getMercadoPagoQrOrderApi } from '../mercadoPagoQr/client';
import { updateMercadoPagoQrOrderFromApi } from '../mercadoPagoQr/repository';
import { dispatchApprovedLocalWalletPayment } from '../localWalletWebhookSettlement';

const PAID_QR_ORDER_STATUSES = new Set(['processed', 'paid']);

type MercadoPagoWebhookEvent = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

export function isMercadoPagoQrOrderWebhookEvent(event: MercadoPagoWebhookEvent): boolean {
  const type = event.type?.toLowerCase() ?? '';
  const action = event.action?.toLowerCase() ?? '';
  return (
    type === 'order' ||
    type === 'merchant_order' ||
    action.includes('order') ||
    action.includes('merchant_order')
  );
}

export async function handleMercadoPagoQrOrderWebhook(event: MercadoPagoWebhookEvent) {
  const mpOrderId = event.data?.id !== undefined ? String(event.data.id) : null;
  if (!mpOrderId) {
    return { ok: true, ignored: 'missing_order_id' };
  }

  const local = await prisma.mercadoPagoQrOrder.findUnique({ where: { mpOrderId } });
  if (!local) {
    return { ok: true, ignored: 'qr_order_not_tracked' };
  }

  const apiOrder = await getMercadoPagoQrOrderApi(mpOrderId);
  const updated = await updateMercadoPagoQrOrderFromApi(local.id, apiOrder);

  // Investor-checkout dynamic QR orders (FiatWalletPanel) carry the platform deposit id
  // or cart batch id as external_reference; merchant "cobrar" orders use an unrelated
  // ad-hoc reference and simply won't match anything downstream (safe no-op).
  if (PAID_QR_ORDER_STATUSES.has(updated.status)) {
    await dispatchApprovedLocalWalletPayment({
      externalReference: updated.externalReference,
      provider: 'mercado_pago_qr',
      providerPaymentId: updated.mpPaymentId,
      amountUsd: null,
      payload: {
        mpOrderId: updated.mpOrderId,
        mpPaymentId: updated.mpPaymentId,
        externalReference: updated.externalReference,
        amountArs: Number(updated.amountArs),
        status: updated.status
      }
    });
  }

  return {
    ok: true,
    orderId: updated.id,
    mpOrderId: updated.mpOrderId,
    status: updated.status,
    mpPaymentId: updated.mpPaymentId
  };
}
