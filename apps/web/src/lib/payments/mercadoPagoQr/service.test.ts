import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from './client';
import * as repository from './repository';
import {
  cancelMercadoPagoQrOrderForUser,
  createMercadoPagoQrOrderForUser,
  normalizeIdempotencyKey,
  shouldShowQrData,
  toMercadoPagoQrOrderView
} from './service';

vi.mock('./client');
vi.mock('./repository');
vi.mock('@sanova/database', () => ({
  prisma: {
    mercadoPagoQrOrder: {
      findUnique: vi.fn()
    }
  }
}));

const baseRecord = {
  id: 'local-1',
  userId: 'user-1',
  mpOrderId: 'ORD01TEST',
  mpPaymentId: 'PAY01TEST',
  externalReference: 'ref-1',
  amountArs: '1500.00',
  description: 'Consulta',
  qrMode: 'dynamic',
  status: 'created',
  statusDetail: 'created',
  qrData: '000201010212',
  expiresAt: new Date('2026-07-02T12:00:00.000Z'),
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  metadata: {},
  createdAt: new Date('2026-07-02T11:44:00.000Z'),
  updatedAt: new Date('2026-07-02T11:44:00.000Z')
};

describe('mercadoPagoQr service', () => {
  beforeEach(() => {
    vi.stubEnv('MP_ACCESS_TOKEN', 'APP_USR-test-token');
    vi.stubEnv('MP_EXTERNAL_POS_ID', 'STORE001POS001');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('normalizes invalid idempotency keys to uuid v4', () => {
    const key = normalizeIdempotencyKey('not-a-uuid');
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('shows qr data only for dynamic and hybrid modes', () => {
    expect(shouldShowQrData('dynamic')).toBe(true);
    expect(shouldShowQrData('hybrid')).toBe(true);
    expect(shouldShowQrData('static')).toBe(false);
  });

  it('maps prisma record to API view', () => {
    const view = toMercadoPagoQrOrderView(baseRecord);
    expect(view.showQr).toBe(true);
    expect(view.amountArs).toBe(1500);
    expect(view.mpPaymentId).toBe('PAY01TEST');
  });

  it('creates order and persists reconciliation ids', async () => {
    vi.mocked(repository.findMercadoPagoQrOrderByIdempotencyKey).mockResolvedValue(null);
    vi.mocked(client.createMercadoPagoQrOrderApi).mockResolvedValue({
      id: 'ORD01TEST',
      status: 'created',
      total_amount: '1500.00',
      type_response: { qr_data: '000201010212' },
      transactions: { payments: [{ id: 'PAY01TEST', amount: '1500.00' }] }
    });
    vi.mocked(repository.upsertMercadoPagoQrOrderFromApi).mockResolvedValue(baseRecord);

    const view = await createMercadoPagoQrOrderForUser({
      userId: 'user-1',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      payload: {
        amount: 1500,
        description: 'Consulta',
        external_reference: 'ref-1',
        items: [{ title: 'Consulta', unit_price: 1500, quantity: 1 }],
        mode: 'dynamic'
      }
    });

    expect(view.mpOrderId).toBe('ORD01TEST');
    expect(view.mpPaymentId).toBe('PAY01TEST');
    expect(client.createMercadoPagoQrOrderApi).toHaveBeenCalledOnce();
  });

  it('returns cached order for repeated idempotency key', async () => {
    vi.mocked(repository.findMercadoPagoQrOrderByIdempotencyKey).mockResolvedValue(baseRecord);

    const view = await createMercadoPagoQrOrderForUser({
      userId: 'user-1',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      payload: {
        amount: 1500,
        description: 'Consulta',
        external_reference: 'ref-1',
        items: [{ title: 'Consulta', unit_price: 1500, quantity: 1 }]
      }
    });

    expect(view.orderId).toBe('local-1');
    expect(client.createMercadoPagoQrOrderApi).not.toHaveBeenCalled();
  });

  it('rejects cancel when order is not in created status', async () => {
    vi.mocked(repository.findMercadoPagoQrOrderForUser).mockResolvedValue({
      ...baseRecord,
      status: 'processed'
    });

    await expect(
      cancelMercadoPagoQrOrderForUser({
        userId: 'user-1',
        orderId: 'local-1',
        idempotencyKey: '22222222-2222-4222-8222-222222222222'
      })
    ).rejects.toThrow('ORDER_NOT_CANCELLABLE');
  });
});
