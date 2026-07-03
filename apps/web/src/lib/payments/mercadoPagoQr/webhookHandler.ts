import { prisma } from '@sanova/database';
import { getMercadoPagoQrOrderApi } from '../mercadoPagoQr/client';
import { updateMercadoPagoQrOrderFromApi } from '../mercadoPagoQr/repository';

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

  return {
    ok: true,
    orderId: updated.id,
    mpOrderId: updated.mpOrderId,
    status: updated.status,
    mpPaymentId: updated.mpPaymentId
  };
}
