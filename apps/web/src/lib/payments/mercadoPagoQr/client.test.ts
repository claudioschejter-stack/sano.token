import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildMercadoPagoQrOrderPayload,
  createMercadoPagoQrOrderApi,
  MercadoPagoQrApiError
} from './client';

describe('mercadoPagoQr client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('builds order payload for dynamic QR', () => {
    const payload = buildMercadoPagoQrOrderPayload({
      amount: 1500,
      description: 'Consulta',
      external_reference: 'ref-123',
      items: [{ title: 'Consulta', unit_price: 1500, quantity: 1 }],
      external_pos_id: 'POS001',
      mode: 'dynamic',
      expiration_time: 'PT16M'
    });

    expect(payload).toMatchObject({
      type: 'qr',
      total_amount: '1500.00',
      config: { qr: { external_pos_id: 'POS001', mode: 'dynamic' } },
      transactions: { payments: [{ amount: '1500.00' }] }
    });
  });

  it('creates order with idempotency header', async () => {
    vi.stubEnv('MP_ACCESS_TOKEN', 'APP_USR-test-token');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: 'ORD01TEST',
          status: 'created',
          type_response: { qr_data: '000201010212' },
          transactions: { payments: [{ id: 'PAY01TEST', amount: '50.00' }] }
        })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createMercadoPagoQrOrderApi(
      {
        amount: 50,
        description: 'Test',
        external_reference: 'ref-1',
        items: [{ title: 'Test', unit_price: 50, quantity: 1 }],
        external_pos_id: 'POS001',
        mode: 'dynamic',
        expiration_time: 'PT16M'
      },
      '11111111-1111-4111-8111-111111111111'
    );

    expect(result.id).toBe('ORD01TEST');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer APP_USR-test-token',
      'X-Idempotency-Key': '11111111-1111-4111-8111-111111111111'
    });
  });

  it('throws MercadoPagoQrApiError on HTTP failure', async () => {
    vi.stubEnv('MP_ACCESS_TOKEN', 'APP_USR-test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"message":"bad_request"}'
      })
    );

    await expect(
      createMercadoPagoQrOrderApi(
        {
          amount: 50,
          description: 'Test',
          external_reference: 'ref-1',
          items: [{ title: 'Test', unit_price: 50, quantity: 1 }],
          external_pos_id: 'POS001',
          mode: 'dynamic',
          expiration_time: 'PT16M'
        },
        '11111111-1111-4111-8111-111111111111'
      )
    ).rejects.toBeInstanceOf(MercadoPagoQrApiError);
  });
});
