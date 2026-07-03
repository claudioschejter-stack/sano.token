import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleMercadoPagoQrOrderWebhook,
  isMercadoPagoQrOrderWebhookEvent
} from './webhookHandler';

vi.mock('./client', () => ({
  getMercadoPagoQrOrderApi: vi.fn()
}));

vi.mock('./repository', () => ({
  updateMercadoPagoQrOrderFromApi: vi.fn()
}));

vi.mock('@sanova/database', () => ({
  prisma: {
    mercadoPagoQrOrder: {
      findUnique: vi.fn()
    }
  }
}));

import { getMercadoPagoQrOrderApi } from './client';
import { updateMercadoPagoQrOrderFromApi } from './repository';
import { prisma } from '@sanova/database';

describe('mercadoPagoQr webhookHandler', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('detects order webhook events', () => {
    expect(isMercadoPagoQrOrderWebhookEvent({ type: 'order', action: 'order.updated' })).toBe(true);
    expect(isMercadoPagoQrOrderWebhookEvent({ type: 'payment', action: 'payment.updated' })).toBe(
      false
    );
  });

  it('syncs tracked QR order from webhook payload', async () => {
    vi.mocked(prisma.mercadoPagoQrOrder.findUnique).mockResolvedValue({
      id: 'local-1',
      mpOrderId: 'ORD01TEST'
    } as never);
    vi.mocked(getMercadoPagoQrOrderApi).mockResolvedValue({
      id: 'ORD01TEST',
      status: 'processed',
      transactions: { payments: [{ id: 'PAY01TEST' }] }
    });
    vi.mocked(updateMercadoPagoQrOrderFromApi).mockResolvedValue({
      id: 'local-1',
      mpOrderId: 'ORD01TEST',
      mpPaymentId: 'PAY01TEST',
      status: 'processed'
    } as never);

    const result = await handleMercadoPagoQrOrderWebhook({
      type: 'order',
      action: 'order.processed',
      data: { id: 'ORD01TEST' }
    });

    expect(result).toMatchObject({
      ok: true,
      mpOrderId: 'ORD01TEST',
      status: 'processed',
      mpPaymentId: 'PAY01TEST'
    });
  });
});
